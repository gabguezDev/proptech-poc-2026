"""Modelo de ranking basado en LightGBM (`LGBMRanker`) entrenado por destilación.

Como no hay feedback real de usuarios, el `ContentRecommender` actúa como
*maestro*: a partir de perfiles simulados genera un `score_compatibilidad`
(0-100) y el alumno aprende a **ordenar** el catálogo según ese criterio.

Pipeline:
  1. `construir_dataset()`: arma (X, y, grupos, scores) por perfil. La etiqueta
     del ranker son **grados de relevancia** derivados por cuantiles del score
     continuo del maestro; cada perfil es un **grupo** (query).
  2. `train()`: ajusta el `LGBMRanker` (objetivo `lambdarank`) con los grupos.
  3. `calibrar()`: ajusta una **regresión isotónica** que mapea el puntaje crudo
     del ranker a la escala 0-100 del maestro (preserva el orden y da un score
     interpretable y comparable entre perfiles).
  4. `predict()`: filtra, calcula features, predice y ordena.
"""

import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.isotonic import IsotonicRegression

from src.data_loader import load_mock_properties
from src.models.content_model import ContentRecommender


USER_FEATURE_COLS = [
    "peso_precio",
    "peso_ubicacion",
    "peso_habitos_confort",
    "peso_amenities",
    "peso_garantias",
    "presupuesto_max",
    "distancia_max_trabajo_km",
    "ruido_bajo",
    "lava_seguido",
    "hace_home_office",
    "hace_deporte",
    "tiene_mascota",
    "requiere_cochera",
    "prefiere_cochera",
    "tiene_garantia_recibo",
    "tiene_garantia_prop",
]

N_GRADOS = 4


def generar_perfiles_sinteticos(n_perfiles: int = 200, seed: int = 42):
  """Genera perfiles de usuario simulados para el entrenamiento por destilación.

  Los valores son plausibles para el dominio (alquileres en Argentina) y cubren
  combinaciones de capacidad económica, garantías, hábitos y entorno.
  """
  rng = np.random.default_rng(seed)
  lat0, lon0 = -27.470, -58.830
  perfiles = []

  for _ in range(n_perfiles):
    pesos = rng.dirichlet([2.0, 2.0, 1.0, 1.0, 1.0])
    perfiles.append({
        "presupuesto_max": float(rng.choice([150000, 190000, 220000, 250000, 300000, 400000])),
        "moneda_preferida": str(rng.choice(["ARS", "USD", "indistinta"])),
        "tiene_garantia_recibo": bool(rng.random() < 0.6),
        "tiene_garantia_prop": bool(rng.random() < 0.4),
        "multiplo_sueldo": float(rng.choice([0.0, 0.0, 2.0, 3.0, 4.0])),
        "tiene_mascota": bool(rng.random() < 0.3),
        "requiere_cochera": bool(rng.random() < 0.3),
        "prefiere_cochera": bool(rng.random() < 0.6),
        "hace_home_office": bool(rng.random() < 0.5),
        "nivel_tolerancia_ruido": str(rng.choice(["bajo", "indiferente"])),
        "frecuencia_lavado": str(rng.choice(["alta", "media", "baja"])),
        "hace_deporte": bool(rng.random() < 0.4),
        "lat_trabajo": float(lat0 + rng.normal(0.0, 0.01)),
        "lon_trabajo": float(lon0 + rng.normal(0.0, 0.01)),
        "distancia_max_trabajo_km": float(rng.choice([3.0, 5.0, 8.0, 10.0])),
        "pesos_usuario": {
            "precio": float(pesos[0]),
            "ubicacion": float(pesos[1]),
            "habitos_confort": float(pesos[2]),
            "amenities": float(pesos[3]),
            "garantias": float(pesos[4]),
        },
    })

  return perfiles


def grados_por_cuantiles(scores) -> np.ndarray:
  """Convierte un score continuo en grados de relevancia (0..N_GRADOS-1).

  Dentro de cada grupo (el ranking de un perfil), se ordena y se reparte en
  `N_GRADOS` intervalos de tamaño similar: los peores candidatos reciben grado 0
  y los mejores, el grado máximo. Es el etiquetado estándar de *learning to
  rank* cuando solo se conoce un orden/score continuo.
  """
  scores = np.asarray(scores, dtype=float)
  n = len(scores)
  if n == 0:
    return np.zeros(0, dtype=int)
  if n == 1:
    return np.zeros(1, dtype=int)

  orden = np.argsort(scores)
  posiciones = np.empty(n, dtype=float)
  posiciones[orden] = np.arange(n)
  grados = np.floor(posiciones / n * N_GRADOS).astype(int)
  return np.clip(grados, 0, N_GRADOS - 1)


class LGBMRecommender:
  """Modelo de ranking basado en LightGBM (`LGBMRanker`).

  Se entrena por **destilación**: usa el `ContentRecommender` como *maestro*
  para generar un score de compatibilidad continuo (0-100) sobre perfiles
  simulados; el alumno convierte ese score en **grados de relevancia** (por
  cuantiles dentro de cada perfil) y aprende a **ordenar** el catálogo. Una
  **regresión isotónica** posterior calibra el puntaje crudo a la escala 0-100.
  """

  def __init__(self, feature_cols: list, pesos_usuario: dict = None,
               content_model: ContentRecommender = None):
    self.feature_cols = list(feature_cols)
    self.content_model = content_model or ContentRecommender(
        feature_cols=self.feature_cols, pesos_usuario=pesos_usuario
    )
    self.model = lgb.LGBMRanker(
        objective="lambdarank",
        n_estimators=200,
        learning_rate=0.05,
        max_depth=5,
        label_gain=[2 ** i - 1 for i in range(N_GRADOS)],
        random_state=42,
        verbosity=-1,
    )
    self.is_trained = False
    self.calibrador = None

  def feature_names(self) -> list:
    return self.feature_cols + USER_FEATURE_COLS

  def _matriz_features(self, df_features: pd.DataFrame, perfil: dict) -> pd.DataFrame:
    """Combina las features usuario-inmueble con las features del usuario."""
    X = df_features[self.feature_cols].copy()

    pesos = self.content_model._normalizar_pesos(perfil.get("pesos_usuario"))
    for dimension, valor in pesos.items():
      X["peso_" + dimension] = valor

    X["presupuesto_max"] = perfil.get("presupuesto_max", 0.0)
    X["distancia_max_trabajo_km"] = perfil.get("distancia_max_trabajo_km", 0.0)
    X["ruido_bajo"] = int(perfil.get("nivel_tolerancia_ruido") == "bajo")
    X["lava_seguido"] = int(perfil.get("frecuencia_lavado") in ("alta", "media"))
    X["hace_home_office"] = int(bool(perfil.get("hace_home_office")))
    X["hace_deporte"] = int(bool(perfil.get("hace_deporte")))
    X["tiene_mascota"] = int(bool(perfil.get("tiene_mascota")))
    X["requiere_cochera"] = int(bool(perfil.get("requiere_cochera")))
    X["prefiere_cochera"] = int(bool(perfil.get("prefiere_cochera")))
    X["tiene_garantia_recibo"] = int(bool(perfil.get("tiene_garantia_recibo")))
    X["tiene_garantia_prop"] = int(bool(perfil.get("tiene_garantia_prop")))

    return X[self.feature_names()]

  def construir_dataset(
      self, perfiles: list, df_properties: pd.DataFrame = None
  ):
    """Arma (X, y_grados, grupos, y_scores) usando al maestro como etiqueta.

    - `y_grados`: grados de relevancia (por cuantiles del score del maestro).
    - `grupos`: tamaño de cada grupo (un perfil = un grupo).
    - `y_scores`: score continuo del maestro (para calibrar la escala 0-100).
    """
    if df_properties is None:
      df_properties = load_mock_properties()

    X_partes, y_partes, score_partes = [], [], []
    grupos = []
    for perfil in perfiles:
      ranking = self.content_model.predict(df_properties, perfil)
      if len(ranking) < 2:
        continue
      scores = ranking["score_compatibilidad"].to_numpy(dtype=float)
      grados = grados_por_cuantiles(scores)
      X_partes.append(self._matriz_features(ranking, perfil))
      y_partes.append(pd.Series(grados, index=ranking.index))
      score_partes.append(pd.Series(scores, index=ranking.index))
      grupos.append(len(ranking))

    if not X_partes:
      return (
          pd.DataFrame(columns=self.feature_names()),
          pd.Series(dtype=int),
          [],
          pd.Series(dtype=float),
      )

    X = pd.concat(X_partes, ignore_index=True)
    y = pd.concat(y_partes, ignore_index=True)
    y_scores = pd.concat(score_partes, ignore_index=True)
    return X, y, grupos, y_scores

  def train(self, X_train: pd.DataFrame, y_train, grupos):
    """Entrena el ranker sobre la matriz de features y los grados de relevancia."""
    self.model.fit(X_train[self.feature_names()], y_train, group=grupos)
    self.is_trained = True
    return self

  def calibrar(self, X_cal: pd.DataFrame, y_scores):
    """Ajusta la calibración isotónica (puntaje crudo -> score 0-100 del maestro)."""
    crudos = self.model.predict(X_cal[self.feature_names()])
    self.calibrador = IsotonicRegression(out_of_bounds="clip")
    self.calibrador.fit(crudos, np.asarray(y_scores, dtype=float))
    return self

  def _fit_cold_start(self, n_perfiles: int = 200, seed: int = 42):
    """Cold start: entrena por destilación si todavía no hay modelo entrenado."""
    perfiles = generar_perfiles_sinteticos(n_perfiles=n_perfiles, seed=seed)
    X, y, grupos, y_scores = self.construir_dataset(perfiles)
    self.train(X, y, grupos)
    self.calibrar(X, y_scores)
    return self

  def _raw_scores(self, X: pd.DataFrame) -> np.ndarray:
    """Puntaje crudo del ranker (solo sirve para ordenar)."""
    return self.model.predict(X[self.feature_names()])

  def _calibrar(self, crudos: np.ndarray) -> np.ndarray:
    """Lleva el puntaje crudo del ranker a la escala 0-100 (si hay calibrador)."""
    if self.calibrador is not None:
      puntajes = self.calibrador.predict(crudos)
    else:
      puntajes = crudos
    return np.clip(puntajes, 0.0, 100.0)

  def _scores(self, X: pd.DataFrame) -> np.ndarray:
    """Puntaje del ranker, calibrado a la escala 0-100."""
    return self._calibrar(self._raw_scores(X))

  def predict(self, df_properties: pd.DataFrame, perfil: dict) -> pd.DataFrame:
    """Predice y ordena las propiedades para un perfil de usuario."""
    df = self.content_model.aplicar_filtros_duros(df_properties, perfil)
    if df.empty:
      return df

    df = self.content_model.calcular_features(df, perfil)

    if not self.is_trained:
      self._fit_cold_start()

    X_predict = self._matriz_features(df, perfil)
    crudos = self._raw_scores(X_predict)
    df["score_compatibilidad"] = np.round(self._calibrar(crudos), 2)

    df["score_precio"] = self.content_model._score_precio(df, perfil).round(4)
    df["score_ubicacion"] = self.content_model._score_ubicacion(df, perfil).round(4)
    df["score_habitos_confort"] = self.content_model._score_habitos(df, perfil).round(4)
    df["score_amenities"] = self.content_model._score_amenities(df, perfil).round(4)
    df["score_garantias"] = self.content_model._score_garantias(df, perfil).round(4)

    scores = df["score_compatibilidad"].to_numpy()
    orden = np.lexsort((-crudos, -scores))
    return df.iloc[orden].reset_index(drop=True)

  def get_feature_importance(self) -> pd.DataFrame:
    """Devuelve la importancia de cada variable (explicabilidad / XAI)."""
    if not self.is_trained:
      return pd.DataFrame(columns=["feature", "importance"])
    return pd.DataFrame({
        "feature": self.feature_names(),
        "importance": self.model.feature_importances_,
    }).sort_values("importance", ascending=False).reset_index(drop=True)

  def save(self, path):
    """Persiste el modelo entrenado y su calibrador en disco."""
    import joblib
    joblib.dump({"model": self.model, "calibrador": self.calibrador}, path)

  def load(self, path):
    """Carga un modelo previamente entrenado desde disco."""
    import joblib
    cargado = joblib.load(path)
    if isinstance(cargado, dict) and "model" in cargado:
      self.model = cargado["model"]
      self.calibrador = cargado.get("calibrador")
    else:
      self.model = cargado
      self.calibrador = None
    self.is_trained = True
    return self
