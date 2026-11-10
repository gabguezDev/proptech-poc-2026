import numpy as np
import pandas as pd

from src.config import (
    DIMENSIONES_SCORE,
    KM_POR_GRADO,
    MONEDAS_INDISTINTAS,
    PESOS_USUARIO_DEFAULT,
    PROXIMIDAD_ESCALA,
    SCORE_SCALE_MAX,
)
from src.utils import clasificar_distancia


class ContentRecommender:
  """Recomendador content-based para el MVP.

  Pipeline:
    1. Filtros duros: descarta inmuebles que incumplen restricciones excluyentes
       (mascotas, presupuesto máximo y cochera obligatoria).
    2. Ingeniería de features: calcula distancia al trabajo, margen de
       presupuesto y match de cochera para cada inmueble sobreviviente.
    3. Score ponderado: puntúa cada dimensión (precio, ubicación,
       hábitos/confort, amenities) de 0.0 a 1.0 y las combina con los
       "pesos_usuario", escalando el resultado final a 0-100.
  """

  def __init__(self, feature_cols: list, pesos_usuario: dict = None):
    self.feature_cols = feature_cols
    self.pesos_usuario = pesos_usuario or PESOS_USUARIO_DEFAULT

  def aplicar_filtros_duros(
      self, df_properties: pd.DataFrame, perfil: dict
  ) -> pd.DataFrame:
    """Descarta inmuebles que el usuario no puede aceptar bajo ningún punto."""
    df = df_properties.copy()

    if perfil.get("tiene_mascota"):
      df = df[df["acepta_mascotas"] == True]
      tamano_usuario = {"chico": 1, "mediano": 2, "grande": 3}.get(
          perfil.get("tamano_mascota") or ""
      )
      if tamano_usuario is not None and "tamano_maximo_mascota" in df.columns:
        orden = {"chico": 1, "mediano": 2, "grande": 3}
        df = df[
            df["tamano_maximo_mascota"].apply(
                lambda maximo: pd.isna(maximo)
                or maximo == "indistinto"
                or orden.get(maximo, 99) >= tamano_usuario
            )
        ]

    tope_ars = perfil.get("presupuesto_max")
    tope_usd = perfil.get("presupuesto_max_usd")
    moneda_col = df["moneda"] if "moneda" in df.columns else pd.Series("ARS", index=df.index)
    a_convenir = (
        df["moneda_a_convenir"] if "moneda_a_convenir" in df.columns else False
    )
    if tope_usd:
      en_ars = moneda_col == "ARS"
      df = df[
          (en_ars & (df["precio"] <= (tope_ars or 0)))
          | ((~en_ars) & (df["precio"] <= tope_usd))
          | (a_convenir == True)
      ]
    else:
      df = df[df["precio"] <= (tope_ars or 0)]

    if perfil.get("requiere_cochera"):
      df = df[df["tiene_cochera"] == True]

    if perfil.get("superficie_min") and "superficie" in df.columns:
      df = df[df["superficie"].fillna(0) >= perfil["superficie_min"]]

    if perfil.get("expensas_max") and "expensas" in df.columns:
      expensas = df["expensas"].apply(
          lambda e: e.get("promedio_ultimos_3_meses") if isinstance(e, dict) else None
      )
      df = df[expensas.fillna(float("inf")) <= perfil["expensas_max"]]

    if perfil.get("duracion_min") and "contrato" in df.columns:
      duracion = df["contrato"].apply(
          lambda c: c.get("duracion_meses") if isinstance(c, dict) else None
      )
      df = df[duracion.isna() | (duracion >= perfil["duracion_min"])]

    dormitorios = perfil.get("cant_dormitorios_min")
    if dormitorios:
      df = df[df["cantidad_habitaciones"].fillna(0) >= dormitorios]

    banos = perfil.get("cant_banos_min")
    if banos:
      df = df[df["cantidad_banos"].fillna(0) >= banos]

    if perfil.get("requiere_balcon"):
      df = df[df["balcon_ubicacion"].fillna("no_tiene") != "no_tiene"]

    preferida = perfil.get("tipologia_preferida")
    mapeo_tipologia = {"depto": "departamento"}
    if preferida and preferida in mapeo_tipologia and "tipologia" in df.columns:
      df = df[df["tipologia"] == mapeo_tipologia[preferida]]

    moneda_preferida = perfil.get("moneda_preferida")
    if (
        moneda_preferida
        and not tope_usd
        and moneda_preferida not in MONEDAS_INDISTINTAS
        and "moneda" in df.columns
    ):
      a_convenir = (
          df["moneda_a_convenir"]
          if "moneda_a_convenir" in df.columns
          else False
      )
      df = df[(df["moneda"] == moneda_preferida) | (a_convenir == True)]

    return df.copy()

  def calcular_features(
      self, df_properties: pd.DataFrame, perfil: dict
  ) -> pd.DataFrame:
    """Genera features derivadas del cruce usuario-inmueble."""
    df = df_properties.copy()

    df["distancia_trabajo"] = (
        np.sqrt(
            (df["lat"] - perfil["lat_trabajo"]) ** 2
            + (df["lon"] - perfil["lon_trabajo"]) ** 2
        )
        * KM_POR_GRADO
    )

    df["margen_presupuesto"] = perfil["presupuesto_max"] - df["precio"]

    df["match_cochera"] = (
        df["tiene_cochera"] == perfil.get("requiere_cochera", False)
    ).astype(int)

    df["tiene_balcon"] = (df["balcon_ubicacion"] != "no_tiene").astype(int)

    df["es_silencioso"] = (
        (df["orientacion"] == "contrafrente")
        | (df["tipo_unidad"] == "interno")
    ).astype(int)

    df["proximidad_salud"] = self._proximidad_serie(
        df,
        ("distancia_caps_m", "distancia_hospital_m", "distancia_clinica_m"),
    )

    df["proximidad_verde"] = self._proximidad_serie(
        df, ("distancia_plaza_m", "distancia_parque_m")
    )

    df["match_garantia"] = self._match_garantia(df, perfil)

    return df

  @staticmethod
  def _min_distancia(proximidad, campos):
    """Menor distancia (en metros) a cualquiera de los campos indicados."""
    if not isinstance(proximidad, dict):
      return None
    valores = [
        proximidad[campo]
        for campo in campos
        if proximidad.get(campo) is not None
    ]
    return min(valores) if valores else None

  @classmethod
  def _score_distancia(cls, metros):
    """Convierte una distancia en metros a un puntaje 0.0-1.0 (o None)."""
    return PROXIMIDAD_ESCALA.get(clasificar_distancia(metros))

  @classmethod
  def _proximidad_serie(cls, df: pd.DataFrame, campos) -> pd.Series:
    """Serie de puntajes de proximidad (0.0-1.0) desde el bloque anidado."""
    if "proximidad" not in df.columns:
      return pd.Series(np.nan, index=df.index)
    serie = df["proximidad"].apply(
        lambda prox: cls._score_distancia(cls._min_distancia(prox, campos))
    )
    return pd.to_numeric(serie, errors="coerce")

  @staticmethod
  def _opciones_garantia_usuario(perfil: dict) -> set:
    """Garantías que el inquilino puede ofrecer según su perfil financiero."""
    opciones = set()
    if perfil.get("tiene_garantia_recibo") or (perfil.get("multiplo_sueldo") or 0) > 0:
      opciones.add("seguro_caucion")
    if perfil.get("tiene_garantia_prop"):
      opciones.add("garantia_a_propietario")
      opciones.add("titulo_propiedad")
    return opciones

  @staticmethod
  def _opciones_garantia_inmueble(garantias) -> set:
    """Garantías que el inmueble acepta según su bloque 'garantias'."""
    if not isinstance(garantias, dict):
      return set()
    return {
        clave
        for clave in ("seguro_caucion", "garantia_a_propietario", "titulo_propiedad")
        if garantias.get(clave)
    }

  def _match_garantia(self, df: pd.DataFrame, perfil: dict) -> pd.Series:
    """1.0 si hay al menos una garantía compatible; 0.0 si ninguna coincide.

    Si falta información (el usuario no acredita garantías o el inmueble no
    trae el bloque), la dimensión queda neutra (1.0) para no penalizar.
    """
    opciones_usuario = self._opciones_garantia_usuario(perfil)
    if not opciones_usuario or "garantias" not in df.columns:
      return pd.Series(1.0, index=df.index)
    return df["garantias"].apply(
        lambda g: 1.0
        if (opciones_usuario & self._opciones_garantia_inmueble(g))
        else 0.0
    )

  def _score_precio(self, df: pd.DataFrame, perfil: dict) -> pd.Series:
    """Premia la holgura presupuestaria relativa al presupuesto máximo."""
    presupuesto = perfil["presupuesto_max"] or 1.0
    return (df["margen_presupuesto"] / presupuesto).clip(0.0, 1.0)

  def _score_ubicacion(self, df: pd.DataFrame, perfil: dict) -> pd.Series:
    """Combina cercanía al trabajo con acceso a salud y espacios verdes."""
    senales = []

    max_km = perfil.get("distancia_max_trabajo_km") or 0.0
    if max_km <= 0:
      senales.append((df["distancia_trabajo"] == 0).astype(float))
    else:
      fraccion = (df["distancia_trabajo"] / max_km).clip(0.0, 1.0)
      if perfil.get("medio_transporte_principal") in ("a_pie", "bici"):
        fraccion = fraccion**1.5
      senales.append(1.0 - fraccion)

    if "proximidad_salud" in df.columns:
      senales.append(df["proximidad_salud"])

    if perfil.get("hace_deporte") and "proximidad_verde" in df.columns:
      senales.append(df["proximidad_verde"])

    if perfil.get("va_al_gimnasio") and "edificio" in df.columns:
      tiene_gimnasio = df["edificio"].apply(
          lambda e: isinstance(e, dict) and bool(e.get("tiene_gimnasio"))
      )
      senales.append(tiene_gimnasio.astype(float))

    validas = [senal for senal in senales if senal.notna().any()]
    if not validas:
      return pd.Series(1.0, index=df.index)
    return pd.concat(validas, axis=1).mean(axis=1)

  def _score_habitos(self, df: pd.DataFrame, perfil: dict) -> pd.Series:
    """Evalúa hábitos y confort (ruido, home office, lavado)."""
    reglas = [
        (
            "hijos_mas_dormitorios",
            lambda p: p.get("tiene_hijos"),
            lambda df: (df["cantidad_habitaciones"].fillna(0) >= 2).astype(float),
        ),
        (
            "ruido_silencio",
            lambda p: p.get("nivel_tolerancia_ruido") == "bajo",
            lambda df: df["es_silencioso"].astype(float),
        ),
        (
            "ruido_zona_quieta",
            lambda p: (
                p.get("nivel_tolerancia_ruido") == "bajo"
                and "proximidad_verde" in df.columns
            ),
            lambda df: df["proximidad_verde"].fillna(0.0),
        ),
        (
            "lavado_lavadero",
            lambda p: (
                p.get("frecuencia_lavado") in ("alta", "media")
                or p.get("requiere_lavadero")
            ),
            lambda df: df["tiene_lavadero"].astype(float),
        ),
    ]

    senales = []
    for _nombre, activa, serie in reglas:
      if activa(perfil):
        senales.append(serie(df))

    if not senales:
      return pd.Series(1.0, index=df.index)

    return sum(senales) / len(senales)

  def _score_amenities(self, df: pd.DataFrame, perfil: dict) -> pd.Series:
    """Evalúa amenities/comodidades (balcón, baño en suite y cochera)."""
    reglas = [
        ("balcon", lambda p: True, lambda df: df["tiene_balcon"].astype(float)),
        (
            "bano_en_suite",
            lambda p: True,
            lambda df: (df["cantidad_banos_en_suite"] > 0).astype(float),
        ),
        (
            "cocina_separada_deseada",
            lambda p: p.get("requiere_cocina_separada"),
            lambda df: df["cocina_separada"].astype(float),
        ),
        (
            "cocina_comedor_deseada",
            lambda p: p.get("cocina_comedor_deseada"),
            lambda df: (~df["cocina_separada"].astype(bool)).astype(float),
        ),
        (
            "living_separado_deseado",
            lambda p: p.get("requiere_living_separado"),
            lambda df: df["living_separado"].astype(float),
        ),
        (
            "planta_baja_deseada",
            lambda p: p.get("planta_baja_deseada"),
            lambda df: (df["piso"].fillna(99) == 0).astype(float),
        ),
        (
            "espacio_moto_bicicleta",
            lambda p: (
                p.get("medio_transporte_principal") == "bici"
                and "espacio_moto_bicicleta" in df.columns
            ),
            lambda df: df["espacio_moto_bicicleta"].fillna(False).astype(float),
        ),
        (
            "patio_deseado",
            lambda p: p.get("requiere_patio") and "tiene_patio" in df.columns,
            lambda df: df["tiene_patio"].fillna(False).astype(float),
        ),
        (
            "patio_cesped_deseado",
            lambda p: p.get("patio_cesped_deseado") and "patio_cesped" in df.columns,
            lambda df: df["patio_cesped"].fillna(False).astype(float),
        ),
        (
            "cochera_deseada",
            lambda p: p.get("prefiere_cochera") or p.get("requiere_cochera"),
            lambda df: df["tiene_cochera"].astype(float),
        ),
        (
            "cochera_techada",
            lambda p: p.get("prefiere_cochera") or p.get("requiere_cochera"),
            lambda df: df["cochera_techada"].astype(float),
        ),
    ]

    if "edificio" in df.columns:
      edificio = df["edificio"]
      for clave, flag in (
          ("requiere_quincho", "tiene_quincho"),
          ("requiere_terraza", "tiene_terraza"),
          ("requiere_piscina", "tiene_piscina"),
          ("requiere_ascensor", "tiene_ascensor"),
      ):
        if perfil.get(clave):
          serie = edificio.apply(
              lambda e, f=flag: isinstance(e, dict) and bool(e.get(f))
          ).astype(float)
          reglas.append(("edificio_" + clave, lambda p: True, lambda df, s=serie: s))

    orientacion = perfil.get("orientacion_preferida")
    if orientacion in ("frente", "contrafrente") and "orientacion" in df.columns:
      esperado = orientacion
      reglas.append(
          (
              "orientacion_preferida",
              lambda p: True,
              lambda df: (df["orientacion"] == esperado).astype(float),
          )
      )

    senales = []
    for _nombre, activa, serie in reglas:
      if activa(perfil):
        senales.append(serie(df))

    if not senales:
      return pd.Series(0.5, index=df.index)
    return sum(senales) / len(senales)

  def _score_garantias(self, df: pd.DataFrame, perfil: dict) -> pd.Series:
    """Puntúa la compatibilidad entre garantías del inquilino y del inmueble."""
    return df["match_garantia"].astype(float)

  def _normalizar_pesos(self, pesos: dict = None) -> dict:
    """Normaliza los pesos para que sumen 1.0, completando dimensiones faltantes."""
    pesos = dict(self.pesos_usuario if pesos is None else pesos)
    for dimension in DIMENSIONES_SCORE:
      pesos.setdefault(dimension, 0.0)

    total = sum(pesos[dimension] for dimension in DIMENSIONES_SCORE)
    if total <= 0:
      neutro = 1.0 / len(DIMENSIONES_SCORE)
      return {dimension: neutro for dimension in DIMENSIONES_SCORE}

    return {dimension: pesos[dimension] / total for dimension in DIMENSIONES_SCORE}

  def predict(self, df_properties: pd.DataFrame, perfil: dict) -> pd.DataFrame:
    """Devuelve el ranking de inmuebles ordenado por score de compatibilidad.

    - df_properties: catálogo completo de inmuebles.
    - perfil: diccionario con las preferencias del usuario (incluye sus pesos).
    """
    df = self.aplicar_filtros_duros(df_properties, perfil)
    if df.empty:
      return df

    df = self.calcular_features(df, perfil)
    pesos = self._normalizar_pesos(perfil.get("pesos_usuario"))

    df["score_precio"] = self._score_precio(df, perfil).round(4)
    df["score_ubicacion"] = self._score_ubicacion(df, perfil).round(4)
    df["score_habitos_confort"] = self._score_habitos(df, perfil).round(4)
    df["score_amenities"] = self._score_amenities(df, perfil).round(4)
    df["score_garantias"] = self._score_garantias(df, perfil).round(4)

    df["score_compatibilidad"] = (
        SCORE_SCALE_MAX
        * sum(
            pesos[dimension] * df["score_{0}".format(dimension)]
            for dimension in DIMENSIONES_SCORE
        )
    ).round(2)

    return df.sort_values(
        by="score_compatibilidad", ascending=False
    ).reset_index(drop=True)
