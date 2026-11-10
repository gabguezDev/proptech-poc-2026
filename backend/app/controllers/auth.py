"""Controlador de autenticación: registro, login, logout y usuario actual."""

from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException

from app.core.dependencias import get_auth_service, requiere_roles
from app.core.seguridad import ROLES_AUTENTICADOS
from app.schemas.auth import LoginRequest, RegistroRequest, TokenResponse, UsuarioResponse
from app.services.auth_service import ServicioAuth
from app.utils.presentacion import respuesta_token

router = APIRouter(tags=["Autenticación"])


@router.post(
    "/auth/registro",
    response_model=TokenResponse,
    status_code=201,
    summary="Registrar un usuario",
    description=(
        "Crea un usuario con rol `seeker`, `prop_owner` o `real_estate_agent` "
        "(el rol `admin` no puede autorregistrarse). Devuelve un token Bearer "
        "listo para usar."
    ),
)
def registrar_usuario(
    datos: RegistroRequest,
    auth: ServicioAuth = Depends(get_auth_service),
):
  try:
    usuario = auth.registrar(datos.email, datos.password, datos.nombre, datos.rol)
  except ValueError as err:
    raise HTTPException(status_code=400, detail=str(err))
  token = auth.crear_sesion(usuario)
  return respuesta_token(usuario, token)


@router.post(
    "/auth/login",
    response_model=TokenResponse,
    summary="Iniciar sesión",
    description="Valida email y contraseña y devuelve un token Bearer de sesión.",
)
def iniciar_sesion(
    datos: LoginRequest,
    auth: ServicioAuth = Depends(get_auth_service),
):
  usuario = auth.autenticar(datos.email, datos.password)
  if not usuario:
    raise HTTPException(
        status_code=401,
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
  if usuario["bloqueado"]:
    raise HTTPException(
        status_code=403,
        detail="Cuenta bloqueada por el administrador",
    )
  token = auth.crear_sesion(usuario)
  return respuesta_token(usuario, token)


@router.post(
    "/auth/logout",
    summary="Cerrar sesión",
    description="Invalida el token Bearer recibido.",
)
def cerrar_sesion(
    authorization: Optional[str] = Header(None),
    auth: ServicioAuth = Depends(get_auth_service),
):
  if authorization and authorization.lower().startswith("bearer "):
    auth.cerrar_sesion(authorization.split(" ", 1)[1].strip())
  return {"status": "ok", "message": "Sesión cerrada"}


@router.get(
    "/auth/me",
    response_model=UsuarioResponse,
    summary="Usuario autenticado actual",
)
def usuario_me(usuario: dict = Depends(requiere_roles(*ROLES_AUTENTICADOS))):
  return usuario
