"""Reglas del feedback del inquilino y su uso en el ranking.

- Explícitos (`favorito`, `me_gusta`, `no_me_gusta`): a lo sumo uno por
  usuario+inmueble. `me_gusta` y `no_me_gusta` son mutuamente excluyentes.
- Interacciones (`visto`, `contacto`, `visita_solicitada`): acumulan
  `repeticiones`.
- En el ranking, los `no_me_gusta` se excluyen y los favoritos / `me_gusta`
  reciben un boost multiplicativo configurable por el administrador.
"""

import time
from typing import Dict, List, Optional

from app.repositories.feedback_repository import RepositorioFeedback
from src.feedback_tipos import (
    REACCIONES,
    SEPARADOR_DETALLE,
    TIPO_FAVORITO,
    TIPO_ME_GUSTA,
    TIPO_NO_ME_GUSTA,
    TIPO_VISITA_CONFIRMADA,
    TIPO_VISITA_SOLICITADA,
    TIPOS,
    TIPOS_INTERACCION,
    VERIFICACIONES,
)


class ServicioFeedback:
  """Casos de uso del feedback del inquilino y de los perfiles consultados."""

  def __init__(self, repositorio: RepositorioFeedback):
    self._repo = repositorio

  def registrar(self, usuario_email: str, id_inmueble: int, tipo: str,
                detalle: Optional[str] = None) -> dict:
    """Registra o actualiza un feedback. ValueError si el tipo no es válido.

    Con `detalle` (p. ej. "distancia_hospital_m") es una verificación de una
    afirmación concreta: las tres opciones son excluyentes **por afirmación**.
    """
    if tipo not in TIPOS:
      raise ValueError("Tipo de feedback inválido: {0}".format(tipo))

    if tipo == TIPO_VISITA_CONFIRMADA:
      solicitud = self._repo.obtener_entrada(
          usuario_email, id_inmueble,
          "{0}{1}dueno".format(TIPO_VISITA_SOLICITADA, SEPARADOR_DETALLE),
      )
      if solicitud is None:
        raise ValueError(
            "Solo podés confirmar tu visita si el propietario te lo pidió"
        )
    if tipo in VERIFICACIONES:
      if self._repo.obtener_entrada(
          usuario_email, id_inmueble, TIPO_VISITA_CONFIRMADA
      ) is None:
        raise ValueError(
            "Para verificar afirmaciones, el propietario debe confirmar "
            "tu visita al inmueble"
        )

    ahora = time.time()
    almacenado = (
        "{0}{1}{2}".format(tipo, SEPARADOR_DETALLE, detalle) if detalle else tipo
    )

    if tipo in REACCIONES:
      opuesto = TIPO_NO_ME_GUSTA if tipo == TIPO_ME_GUSTA else TIPO_ME_GUSTA
      self._repo.quitar_tipo(usuario_email, id_inmueble, opuesto)

    if tipo in VERIFICACIONES:
      for otro in VERIFICACIONES:
        if otro != tipo:
          forma = (
              "{0}{1}{2}".format(otro, SEPARADOR_DETALLE, detalle)
              if detalle
              else otro
          )
          self._repo.quitar_tipo(usuario_email, id_inmueble, forma)

    existente = self._repo.obtener_entrada(usuario_email, id_inmueble, almacenado)
    if existente is None:
      return self._repo.crear_entrada(usuario_email, id_inmueble, almacenado, ahora)
    repeticiones = None
    if tipo in TIPOS_INTERACCION:
      repeticiones = (existente["repeticiones"] or 1) + 1
    return self._repo.actualizar_entrada(
        usuario_email, id_inmueble, almacenado, ahora, repeticiones
    )

  def eliminar(self, usuario_email: str, id_inmueble: int,
               tipo: Optional[str] = None) -> int:
    """Quita el feedback del usuario sobre un inmueble. Devuelve cuántos quitó."""
    if tipo in VERIFICACIONES:
      quitados = 0
      for entrada in self.listar_usuario(usuario_email):
        if entrada["id_inmueble"] != id_inmueble or entrada["tipo"] != tipo:
          continue
        forma = (
            "{0}{1}{2}".format(tipo, SEPARADOR_DETALLE, entrada["detalle"])
            if entrada.get("detalle")
            else tipo
        )
        quitados += self._repo.eliminar(usuario_email, id_inmueble, forma)
      return quitados
    return self._repo.eliminar(usuario_email, id_inmueble, tipo)

  def listar_usuario(self, usuario_email: str, tipo: Optional[str] = None) -> List[dict]:
    return self._repo.listar_usuario(usuario_email, tipo)

  def mapa_usuario(self, usuario_email: str) -> Dict[int, List[str]]:
    """{id_inmueble: [tipos]} del usuario."""
    mapa: Dict[int, List[str]] = {}
    for entrada in self.listar_usuario(usuario_email):
      mapa.setdefault(entrada["id_inmueble"], []).append(entrada["tipo"])
    return mapa

  def resumen_inmueble(self, id_inmueble: int) -> Dict[str, int]:
    resumen = {tipo: 0 for tipo in TIPOS}
    for tipo, cantidad in self._repo.conteo_por_tipo(id_inmueble).items():
      resumen[tipo] = resumen.get(tipo, 0) + cantidad
    return resumen

  def listar_todos(self) -> List[dict]:
    return self._repo.listar_todos()

  def guardar_perfil(self, usuario_email: str, perfil: dict) -> None:
    self._repo.guardar_perfil(usuario_email, perfil, time.time())

  def obtener_perfil(self, usuario_email: str) -> Optional[dict]:
    return self._repo.obtener_perfil(usuario_email)

  def listar_perfiles(self) -> Dict[str, dict]:
    return self._repo.listar_perfiles()

  def aplicar_ranking(self, df, usuario_email: str, boost: float = 1.0):
    """Excluye los 'no me gusta' y aplica `boost` a favoritos / 'me gusta'.

    Devuelve `(df_ajustado, mapa)` donde `mapa` es `{id_inmueble: [tipos]}`.
    """
    mapa = self.mapa_usuario(usuario_email)
    excluir = {id_ for id_, tipos in mapa.items() if TIPO_NO_ME_GUSTA in tipos}
    destacar = {
        id_ for id_, tipos in mapa.items()
        if TIPO_FAVORITO in tipos or TIPO_ME_GUSTA in tipos
    }

    resultado = df
    if excluir:
      resultado = resultado[~resultado["id_inmueble"].isin(excluir)].copy()

    puede_boostear = (
        boost and boost != 1.0 and destacar
        and "score_compatibilidad" in resultado.columns
    )
    if puede_boostear:
      mascara = resultado["id_inmueble"].isin(destacar)
      if mascara.any():
        resultado = resultado.copy()
        resultado.loc[mascara, "score_compatibilidad"] = (
            resultado.loc[mascara, "score_compatibilidad"] * boost
        ).clip(upper=100.0).round(2)
        resultado = resultado.sort_values("score_compatibilidad", ascending=False)
    return resultado, mapa

  def confirmar_visita(self, usuario_email: str, id_inmueble: int) -> dict:
    """Registra la visita confirmada (sin exigir solicitud previa)."""
    ahora = time.time()
    existente = self._repo.obtener_entrada(
        usuario_email, id_inmueble, TIPO_VISITA_CONFIRMADA
    )
    if existente is None:
      return self._repo.crear_entrada(
          usuario_email, id_inmueble, TIPO_VISITA_CONFIRMADA, ahora
      )
    return self._repo.actualizar_entrada(
        usuario_email, id_inmueble, TIPO_VISITA_CONFIRMADA, ahora, None
    )

  def notificar_visita(self, usuario_email: str, id_inmueble: int) -> dict:
    """El dueño pide al buscador que confirme su visita (solicitud dueno)."""
    if self._repo.obtener_entrada(
        usuario_email, id_inmueble, TIPO_VISITA_CONFIRMADA
    ) is not None:
      raise ValueError("La visita ya está confirmada")
    almacenado = "{0}{1}dueno".format(TIPO_VISITA_SOLICITADA, SEPARADOR_DETALLE)
    existente = self._repo.obtener_entrada(usuario_email, id_inmueble, almacenado)
    ahora = time.time()
    if existente is None:
      return self._repo.crear_entrada(usuario_email, id_inmueble, almacenado, ahora)
    return self._repo.actualizar_entrada(
        usuario_email, id_inmueble, almacenado, ahora, None
    )

  def sembrar_demo(self, usuario_email: str, perfil: dict, items) -> bool:
    """Carga feedback + perfil de un usuario demo. Idempotente por usuario."""
    if self.listar_usuario(usuario_email):
      return False
    for id_inmueble, tipo in items:
      self.registrar(usuario_email, id_inmueble, tipo)
    self.guardar_perfil(usuario_email, perfil)
    return True


_servicio: Optional[ServicioFeedback] = None


def obtener_servicio_feedback() -> ServicioFeedback:
  global _servicio
  if _servicio is None:
    _servicio = ServicioFeedback(RepositorioFeedback())
  return _servicio


def fijar_servicio_feedback(servicio: Optional[ServicioFeedback]) -> None:
  """Reemplaza la instancia del proceso (tests que aíslan la base)."""
  global _servicio
  _servicio = servicio
