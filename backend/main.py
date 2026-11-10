"""Punto de entrada de la API: compone la app FastAPI con los routers por capa.

Estructura del backend (ver `AGENTS.md`):

  controllers  -> HTTP: rutas, validación de entrada, códigos de estado
  schemas      -> contrato Pydantic de request/response (Swagger)
  services     -> reglas de negocio (auth, inmuebles, feedback, ranking, métricas)
  repositories -> acceso a la base (solo SQLAlchemy, sin reglas)
  models       -> entidades ORM
  core         -> seguridad, dependencias de FastAPI, cuentas semilla, datos demo
  utils        -> presentación (score_carga, respuestas)

El dominio numérico (modelos, completitud, evaluación) vive en `src/`: no
depende de FastAPI ni de la base de datos.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.controllers import admin, auth, feedback, inmuebles, recomendaciones, sistema
from app.core import cuentas_semilla as cuentas
from app.core.datos_demo import FEEDBACK_DEMO_INQUILINO, PERFIL_DEMO_INQUILINO
from app.services.ajuste_service import obtener_servicio_ajustes
from app.services.auth_service import obtener_servicio_auth
from app.services.feedback_service import obtener_servicio_feedback
from app.services.inmueble_service import obtener_servicio_inmuebles
from app.services.recomendacion_service import inicializar_recommender
from src import db
from src.config import API_DESCRIPTION, API_TITLE, API_VERSION


@asynccontextmanager
async def lifespan(app: FastAPI):
  """Al arrancar: crea el esquema, carga ajustes, inicializa el modelo y siembra."""
  db.inicializar()
  obtener_servicio_ajustes().cargar()
  inicializar_recommender()

  auth = obtener_servicio_auth()
  auth.sembrar_admin()
  auth.sembrar_cuentas_demo()
  auth.sembrar_cuenta_buscador()

  inmuebles = obtener_servicio_inmuebles()
  inmuebles.sembrar(cuentas.email_propietario_demo(), cuentas.email_agente_demo())
  inmuebles.sembrar_extra(cuentas.email_propietario_demo(), cuentas.email_agente_demo())

  feedback = obtener_servicio_feedback()
  feedback.sembrar_demo(
      cuentas.email_buscador_demo(), PERFIL_DEMO_INQUILINO, FEEDBACK_DEMO_INQUILINO
  )
  yield


app = FastAPI(
    title=API_TITLE,
    description=(
        API_DESCRIPTION
        + "\n\n"
        "**Autenticación**: registrarse en `POST /auth/registro` y obtener un "
        "token Bearer en `POST /auth/login`. Los roles son `admin`, "
        "`prop_owner`, `real_estate_agent`, `seeker` y `visitor` (visitante no "
        "registrado).\n\n"
        "**Campos solicitados al USUARIO**: ver el body del request en "
        "`POST /recommend` (esquema `UserPreferences`).\n\n"
        "**Campos solicitados a la PROPIEDAD**: ver el esquema `Inmueble` "
        "(y sus bloques `Expensas`, `Edificio`, `Proximidad`, `Contrato`, "
        "`Garantias`, `Pension`), devuelto en `GET /propiedades` y en cada "
        "resultado de `POST /recommend`."
    ),
    version=API_VERSION,
    lifespan=lifespan,
    openapi_tags=[
        {"name": "Autenticación", "description": "Registro, login y usuario actual."},
        {"name": "Usuario", "description": "Perfil del inquilino (demanda)."},
        {
            "name": "Feedback",
            "description": "Feedback del inquilino: favoritos, reacciones e "
            "interacciones (lado demanda).",
        },
        {"name": "Propiedades", "description": "Datos del inmueble (oferta)."},
        {
            "name": "Administración",
            "description": "Configuración de la plataforma (solo rol `admin`).",
        },
        {"name": "Sistema", "description": "Estado del servicio."},
    ],
)

app.include_router(sistema.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(feedback.router)
app.include_router(inmuebles.router)
app.include_router(recomendaciones.router)


if __name__ == "__main__":
  import uvicorn

  uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
