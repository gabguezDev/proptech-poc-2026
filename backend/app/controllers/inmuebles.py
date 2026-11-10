"""Controlador de inmuebles: catálogo público, alta/edición y completitud."""

from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.core.dependencias import (
    get_auth_service,
    get_feedback_service,
    get_inmueble_service,
    requiere_roles,
    usuario_actual,
)
from app.core.seguridad import ROL_ADMIN, ROL_AGENTE, ROL_PROPIETARIO
from app.schemas.inmueble import (
    CompletitudResponse,
    Inmueble,
    InmuebleCreate,
    InmuebleGestionado,
    InmuebleUpdate,
)
from app.services.auth_service import obtener_servicio_auth
from app.services.feedback_service import ServicioFeedback
from app.services.inmueble_service import ServicioInmuebles
from app.repositories.validacion_repository import RepositorioValidaciones
from app.services.storage_service import (
    MAX_BYTES_ARCHIVO,
    MAX_FOTOS,
    TIPOS_PERMITIDOS,
    obtener_servicio_storage,
)
from app.utils.exif import gps_de_foto
from app.utils.presentacion import con_score_carga, ownership_del_creador
from src.completeness import calcular_score_carga, detalle_completitud
from src.fotos import (
    AMBIENTES_CON_NUMERO,
    MAX_FOTOS_POR_SECCION,
    contar_fotos_en_seccion,
    error_etiqueta,
    etiqueta_seccion,
)
from src.feedback_tipos import (
    TIPO_NO_VIO,
    TIPO_VISITA_CONFIRMADA,
    TIPO_VISITA_SOLICITADA,
)
from src.proximidad_grupos import GRUPOS_PROXIMIDAD, distancia_grupo
from src.utils import haversine_km

router = APIRouter(tags=["Propiedades"])

ROLES_OFERTA = (ROL_ADMIN, ROL_PROPIETARIO, ROL_AGENTE)


@router.get(
    "/propiedades/{id_inmueble}",
    response_model=Inmueble,
    summary="Detalle de una propiedad publicada (página dedicada)",
    description=(
        "Devuelve un inmueble publicado con su galería de fotos/videos. Un "
        "borrador solo lo ve quien lo gestiona; las alquiladas o no "
        "disponibles no se exponen en el catálogo público."
    ),
)
def detalle_propiedad(
    id_inmueble: int,
    inmuebles: ServicioInmuebles = Depends(get_inmueble_service),
    usuario: dict = Depends(usuario_actual),
):
  registro = inmuebles.obtener(id_inmueble)
  if registro is None:
    raise HTTPException(
        status_code=404, detail="Inmueble no encontrado: {0}".format(id_inmueble)
    )
  es_borrador = registro.get("estado") == "borrador"
  if es_borrador and not inmuebles.gestiona(registro, usuario):
    raise HTTPException(
        status_code=404, detail="Inmueble no encontrado: {0}".format(id_inmueble)
    )
  return con_score_carga(registro)


@router.get(
    "/propiedades",
    response_model=List[Inmueble],
    summary="Catálogo de inmuebles (campos solicitados a la propiedad)",
)
def listar_propiedades(
    inmuebles: ServicioInmuebles = Depends(get_inmueble_service),
):
  """Devuelve el catálogo con todos los campos que aporta la propiedad.

  Cada inmueble incluye su `score_carga` (completitud de los datos cargados).
  """
  registros = inmuebles.load_properties().to_dict(orient="records")
  for registro in registros:
    registro["score_carga"] = calcular_score_carga(registro)
  return registros


@router.get(
    "/propiedades/{id_inmueble}/completitud",
    response_model=CompletitudResponse,
    summary="Score de carga (completitud) de un inmueble",
    description=(
        "Devuelve el score de carga de un inmueble: qué tan completos están los "
        "datos que cargó el propietario (0-100), el detalle por grupo y la lista "
        "de campos faltantes. A mayor carga, mayor probabilidad de matchear."
    ),
)
def completitud_inmueble(
    id_inmueble: int,
    inmuebles: ServicioInmuebles = Depends(get_inmueble_service),
    usuario: dict = Depends(requiere_roles(*ROLES_OFERTA)),
):
  registro = inmuebles.obtener(id_inmueble)
  if registro is None:
    raise HTTPException(
        status_code=404, detail="Inmueble no encontrado: {0}".format(id_inmueble)
    )
  if not inmuebles.gestiona(registro, usuario):
    raise HTTPException(
        status_code=403, detail="No gestionás el inmueble {0}".format(id_inmueble)
    )
  return detalle_completitud(registro)


@router.get(
    "/mis-inmuebles",
    response_model=List[InmuebleGestionado],
    summary="Inmuebles que gestiona el usuario autenticado",
    description=(
        "Devuelve los inmuebles de los que el usuario es propietario "
        "(`prop_owner`) o agente a cargo (`real_estate_agent`). Un `admin` ve "
        "todos. Incluye la propiedad (`propietario_email`/`agente_email`) y el "
        "`score_carga` de cada uno."
    ),
)
def mis_inmuebles(
    inmuebles: ServicioInmuebles = Depends(get_inmueble_service),
    usuario: dict = Depends(requiere_roles(*ROLES_OFERTA)),
):
  registros = inmuebles.gestionados_por(usuario)
  return [con_score_carga(registro) for registro in registros]


@router.post(
    "/propiedades",
    response_model=InmuebleGestionado,
    status_code=201,
    summary="Dar de alta un inmueble (prop_owner / real_estate_agent / admin)",
    description=(
        "Crea un inmueble. La propiedad se asigna según quién lo crea: "
        "`prop_owner` queda como propietario; `real_estate_agent` queda como "
        "agente a cargo; `admin` no asigna dueño. El `id_inmueble` es opcional."
    ),
)
def crear_propiedad(
    datos: InmuebleCreate,
    inmuebles: ServicioInmuebles = Depends(get_inmueble_service),
    usuario: dict = Depends(requiere_roles(*ROLES_OFERTA)),
):
  propietario, agente = ownership_del_creador(usuario)
  try:
    registro = inmuebles.crear(datos.model_dump(), propietario, agente)
  except ValueError as err:
    raise HTTPException(status_code=400, detail=str(err))
  return con_score_carga(registro)


@router.put(
    "/propiedades/{id_inmueble}",
    response_model=InmuebleGestionado,
    summary="Editar / completar un inmueble (solo quien lo gestiona)",
    description=(
        "Actualiza parcialmente un inmueble: solo se modifican los campos "
        "enviados. Los bloques anidados (expensas, edificio, proximidad, "
        "contrato, garantias, pension), si se envían, van completos. Requiere "
        "ser el propietario, el agente a cargo o un `admin`."
    ),
)
def actualizar_propiedad(
    id_inmueble: int,
    datos: InmuebleUpdate,
    inmuebles: ServicioInmuebles = Depends(get_inmueble_service),
    usuario: dict = Depends(requiere_roles(*ROLES_OFERTA)),
):
  registro = inmuebles.obtener(id_inmueble)
  if registro is None:
    raise HTTPException(
        status_code=404, detail="Inmueble no encontrado: {0}".format(id_inmueble)
    )
  if not inmuebles.gestiona(registro, usuario):
    raise HTTPException(
        status_code=403, detail="No gestionás el inmueble {0}".format(id_inmueble)
    )
  cambios = datos.model_dump(exclude_unset=True)
  actualizado = inmuebles.actualizar(id_inmueble, cambios)
  return con_score_carga(actualizado)


@router.post(
    "/propiedades/{id_inmueble}/fotos",
    response_model=InmuebleGestionado,
    summary="Subir fotos/videos de un inmueble (solo quien lo gestiona)",
    description=(
        "Los archivos se guardan en el almacenamiento local (SeaweedFS) y "
        "sus URLs públicas quedan en `fotos`. Máximo 15 archivos por "
        "publicación, imágenes y videos hasta 25 MB cada uno. Si se indica "
        "`ambiente` (y opcionalmente `ambiente2`), la foto queda etiquetada "
        "por la sección que muestra (dormitorio / baño con `numero` 1..N); "
        "cada sección admite hasta 2 fotos."
    ),
)
async def subir_fotos(
    id_inmueble: int,
    archivos: List[UploadFile] = File(...),
    ambiente: Optional[str] = Form(None),
    numero: Optional[int] = Form(None),
    ambiente2: Optional[str] = Form(None),
    numero2: Optional[int] = Form(None),
    inmuebles: ServicioInmuebles = Depends(get_inmueble_service),
    usuario: dict = Depends(requiere_roles(*ROLES_OFERTA)),
):
  registro = inmuebles.obtener(id_inmueble)
  if registro is None:
    raise HTTPException(
        status_code=404, detail="Inmueble no encontrado: {0}".format(id_inmueble)
    )
  if not inmuebles.gestiona(registro, usuario):
    raise HTTPException(
        status_code=403, detail="No gestionás el inmueble {0}".format(id_inmueble)
    )
  fotos_actuales = list(registro.get("fotos") or [])
  if len(fotos_actuales) + len(archivos) > MAX_FOTOS:
    raise HTTPException(
        status_code=400,
        detail="La galería admite hasta {0} archivos".format(MAX_FOTOS),
    )

  etiquetada = ambiente is not None
  numero_guardado = numero if ambiente in AMBIENTES_CON_NUMERO else None
  numero2_guardado = numero2 if ambiente2 in AMBIENTES_CON_NUMERO else None
  if etiquetada:
    for ambiente_i, numero_i in ((ambiente, numero), (ambiente2, numero2)):
      if ambiente_i is None:
        continue
      mensaje = error_etiqueta(ambiente_i, numero_i, registro)
      if mensaje:
        raise HTTPException(status_code=400, detail=mensaje)
    for ambiente_i, numero_i in (
        (ambiente, numero_guardado),
        (ambiente2, numero2_guardado),
    ):
      if ambiente_i is None:
        continue
      ya = contar_fotos_en_seccion(fotos_actuales, ambiente_i, numero_i)
      if ya + len(archivos) > MAX_FOTOS_POR_SECCION:
        raise HTTPException(
            status_code=400,
            detail="La sección {0} ya tiene {1} fotos (máximo {2})".format(
                etiqueta_seccion(ambiente_i, numero_i), ya, MAX_FOTOS_POR_SECCION
            ),
        )

  storage = obtener_servicio_storage()
  nuevas = []
  base_orden = len(fotos_actuales)
  for indice, archivo in enumerate(archivos):
    tipo = archivo.content_type or ""
    if tipo not in TIPOS_PERMITIDOS:
      raise HTTPException(
          status_code=400,
          detail="Tipo no permitido: {0} (usá imágenes o videos mp4/webm)".format(tipo),
      )
    contenido = await archivo.read()
    if len(contenido) > MAX_BYTES_ARCHIVO:
      raise HTTPException(
          status_code=400,
          detail="Archivo demasiado grande: {0}".format(archivo.filename),
      )
    url = storage.subir(id_inmueble, archivo.filename or "foto", contenido, tipo)
    if etiquetada:
      nuevas.append({
          "url": url,
          "ambiente": ambiente,
          "numero": numero_guardado,
          "ambiente2": ambiente2,
          "numero2": numero2_guardado,
          "orden": base_orden + indice,
          "portada": (base_orden + indice) == 0,
      })
    else:
      nuevas.append(url)
  actualizado = inmuebles.actualizar(
      id_inmueble, {"fotos": fotos_actuales + nuevas}
  )
  return con_score_carga(actualizado)


class VisitaConfirmar(BaseModel):
  """Confirmación de visita por el dueño/agente."""

  usuario_email: str = Field(..., description="Email del inquilino que visitó")


@router.post(
    "/propiedades/{id_inmueble}/visita",
    status_code=201,
    summary="Confirmar la visita de un inquilino (solo quien gestiona)",
    description=(
        "El dueño/agente confirma que el inquilino visitó el inmueble. Solo "
        "después de esta confirmación el inquilino puede verificar las "
        "afirmaciones de la publicación (vio / no vio / no sé)."
    ),
)
def confirmar_visita(
    id_inmueble: int,
    datos: VisitaConfirmar,
    inmuebles: ServicioInmuebles = Depends(get_inmueble_service),
    feedback: ServicioFeedback = Depends(get_feedback_service),
    usuario: dict = Depends(requiere_roles(*ROLES_OFERTA)),
):
  registro = inmuebles.obtener(id_inmueble)
  if registro is None:
    raise HTTPException(
        status_code=404, detail="Inmueble no encontrado: {0}".format(id_inmueble)
    )
  if not inmuebles.gestiona(registro, usuario):
    raise HTTPException(
        status_code=403, detail="No gestionás el inmueble {0}".format(id_inmueble)
    )
  email = (datos.usuario_email or "").strip().lower()
  if obtener_servicio_auth().por_email(email) is None:
    raise HTTPException(status_code=404, detail="Usuario no encontrado: {0}".format(email))
  entrada = feedback.confirmar_visita(email, id_inmueble)
  return {
      "status": "ok",
      "usuario_email": email,
      "id_inmueble": id_inmueble,
      "tipo": entrada["tipo"],
  }


@router.post(
    "/propiedades/{id_inmueble}/visita/notificar",
    status_code=201,
    summary="Notificar a un buscador para que confirme su visita (solo quien gestiona)",
    description=(
        "El dueño/agente le pide al buscador que confirme su visita: queda "
        "registrado como solicitud del propietario y el buscador puede "
        "autoconfirmarla desde la publicación."
    ),
)
def notificar_visita(
    id_inmueble: int,
    datos: VisitaConfirmar,
    inmuebles: ServicioInmuebles = Depends(get_inmueble_service),
    feedback: ServicioFeedback = Depends(get_feedback_service),
    usuario: dict = Depends(requiere_roles(*ROLES_OFERTA)),
):
  registro = inmuebles.obtener(id_inmueble)
  if registro is None:
    raise HTTPException(
        status_code=404, detail="Inmueble no encontrado: {0}".format(id_inmueble)
    )
  if not inmuebles.gestiona(registro, usuario):
    raise HTTPException(
        status_code=403, detail="No gestionás el inmueble {0}".format(id_inmueble)
    )
  email = (datos.usuario_email or "").strip().lower()
  if obtener_servicio_auth().por_email(email) is None:
    raise HTTPException(status_code=404, detail="Usuario no encontrado: {0}".format(email))
  try:
    feedback.notificar_visita(email, id_inmueble)
  except ValueError as err:
    raise HTTPException(status_code=400, detail=str(err))
  return {
      "status": "ok",
      "usuario_email": email,
      "id_inmueble": id_inmueble,
      "notificado": True,
  }


@router.get(
    "/propiedades/{id_inmueble}/visitas",
    summary="Visitas solicitadas y confirmadas de un inmueble (solo quien gestiona)",
    description=(
        "Lista los inquilinos que solicitaron visita o cuya visita ya fue "
        "confirmada, para que el dueño/agente los confirme."
    ),
)
def listar_visitas(
    id_inmueble: int,
    inmuebles: ServicioInmuebles = Depends(get_inmueble_service),
    feedback: ServicioFeedback = Depends(get_feedback_service),
    usuario: dict = Depends(requiere_roles(*ROLES_OFERTA)),
):
  registro = inmuebles.obtener(id_inmueble)
  if registro is None:
    raise HTTPException(
        status_code=404, detail="Inmueble no encontrado: {0}".format(id_inmueble)
    )
  if not inmuebles.gestiona(registro, usuario):
    raise HTTPException(
        status_code=403, detail="No gestionás el inmueble {0}".format(id_inmueble)
    )
  por_email = {}
  for entrada in feedback.listar_todos():
    if entrada["id_inmueble"] != id_inmueble:
      continue
    if entrada["tipo"] not in (TIPO_VISITA_SOLICITADA, TIPO_VISITA_CONFIRMADA):
      continue
    info = por_email.setdefault(
        entrada["usuario_email"], {"confirmada": False, "repeticiones": 0}
    )
    if entrada["tipo"] == TIPO_VISITA_CONFIRMADA:
      info["confirmada"] = True
    else:
      info["repeticiones"] += entrada["repeticiones"]
  return [{"usuario_email": email, **info} for email, info in por_email.items()]


@router.get(
    "/propiedades/{id_inmueble}/validaciones",
    summary="Refutaciones y validaciones de un inmueble (solo quien gestiona)",
    description=(
        "Lista las afirmaciones refutadas por visitantes (vio / no vio / no sé) "
        "pendientes de validar, junto con las validaciones ya realizadas con "
        "foto y ubicación."
    ),
)
def listar_validaciones(
    id_inmueble: int,
    inmuebles: ServicioInmuebles = Depends(get_inmueble_service),
    feedback: ServicioFeedback = Depends(get_feedback_service),
    usuario: dict = Depends(requiere_roles(*ROLES_OFERTA)),
):
  registro = inmuebles.obtener(id_inmueble)
  if registro is None:
    raise HTTPException(
        status_code=404, detail="Inmueble no encontrado: {0}".format(id_inmueble)
    )
  if not inmuebles.gestiona(registro, usuario):
    raise HTTPException(
        status_code=403, detail="No gestionás el inmueble {0}".format(id_inmueble)
    )
  refutaciones = {}
  for entrada in feedback.listar_todos():
    if (
        entrada["id_inmueble"] == id_inmueble
        and entrada["tipo"] == TIPO_NO_VIO
        and entrada.get("detalle")
    ):
      refutaciones.setdefault(entrada["detalle"], 0)
      refutaciones[entrada["detalle"]] += 1
  validaciones = RepositorioValidaciones().listar_por_inmueble(id_inmueble)
  validadas = {v["detalle"] for v in validaciones}
  return {
      "pendientes": [
          {"detalle": detalle, "refutaciones": cantidad}
          for detalle, cantidad in refutaciones.items()
          if detalle not in validadas
      ],
      "validaciones": validaciones,
  }


@router.post(
    "/propiedades/{id_inmueble}/validar",
    status_code=201,
    summary="Validar una afirmación refutada con foto y ubicación",
    description=(
        "El dueño/agente sube una foto del punto de interés: la ubicación sale "
        "del GPS de la foto (EXIF) y, si no lo tiene, de la enviada. Se mide "
        "la distancia real desde el inmueble; si coincide con lo declarado "
        "queda como validado, si no se corrige la publicación."
    ),
)
async def validar_afirmacion(
    id_inmueble: int,
    detalle: str = Form(...),
    lat: float = Form(None),
    lon: float = Form(None),
    foto: UploadFile = File(...),
    inmuebles: ServicioInmuebles = Depends(get_inmueble_service),
    usuario: dict = Depends(requiere_roles(*ROLES_OFERTA)),
):
  registro = inmuebles.obtener(id_inmueble)
  if registro is None:
    raise HTTPException(
        status_code=404, detail="Inmueble no encontrado: {0}".format(id_inmueble)
    )
  if not inmuebles.gestiona(registro, usuario):
    raise HTTPException(
        status_code=403, detail="No gestionás el inmueble {0}".format(id_inmueble)
    )
  proximidad = registro.get("proximidad") or {}
  clave_campo = detalle if detalle.startswith("distancia_") else "distancia_{0}_m".format(detalle)
  declarado = proximidad.get(clave_campo)
  if declarado is None and detalle in GRUPOS_PROXIMIDAD:
    declarado = distancia_grupo(proximidad, detalle)
    clave_campo = GRUPOS_PROXIMIDAD[detalle][0] if declarado is not None else clave_campo
  if declarado is None:
    raise HTTPException(
        status_code=400,
        detail="Afirmación desconocida o sin distancia declarada: {0}".format(detalle),
    )
  contenido = await foto.read()
  if len(contenido) > MAX_BYTES_ARCHIVO:
    raise HTTPException(status_code=400, detail="Archivo demasiado grande")
  gps = gps_de_foto(contenido)
  if gps is not None:
    lat_m, lon_m = gps
  elif lat is not None and lon is not None:
    lat_m, lon_m = lat, lon
  else:
    raise HTTPException(
        status_code=400,
        detail="La foto no tiene GPS: enviá la ubicación del punto de interés",
    )
  url_foto = obtener_servicio_storage().subir(
      id_inmueble, foto.filename or "validacion.jpg", contenido,
      foto.content_type or "image/jpeg",
  )
  medida = haversine_km(registro["lat"], registro["lon"], lat_m, lon_m) * 1000
  tolerancia = max(150.0, 0.25 * declarado)
  if abs(medida - declarado) <= tolerancia:
    resultado = "validado"
  else:
    resultado = "corregido"
    if detalle in GRUPOS_PROXIMIDAD:
      for clave in GRUPOS_PROXIMIDAD[detalle]:
        proximidad[clave] = round(medida)
    else:
      proximidad[clave_campo] = round(medida)
    inmuebles.actualizar(id_inmueble, {"proximidad": proximidad})
  return RepositorioValidaciones().crear(
      id_inmueble=id_inmueble,
      detalle=clave_campo,
      foto_url=url_foto,
      lat=lat_m,
      lon=lon_m,
      distancia_medida=round(medida, 1),
      distancia_declarada=declarado,
      resultado=resultado,
  )
