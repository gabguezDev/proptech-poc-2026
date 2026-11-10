"""Esquemas Pydantic (contrato HTTP) de autenticación y administración."""

from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, create_model

class RegistroRequest(BaseModel):
  """Datos para registrar un usuario. El rol no puede ser `admin`."""

  model_config = ConfigDict(
      json_schema_extra={
          "example": {
              "email": "ana@example.com",
              "password": "Secreto123!",
              "nombre": "Ana",
              "rol": "seeker",
          }
      }
  )

  email: str = Field(..., description="Email del usuario")
  password: str = Field(
      ...,
      min_length=8,
      description="Contraseña: mín. 8 caracteres, con mayúscula, minúscula, "
      "número y carácter especial",
  )
  nombre: Optional[str] = Field(None, description="Nombre para mostrar")
  rol: str = Field(
      "seeker",
      description="Rol a registrar: seeker / prop_owner / real_estate_agent",
  )


class LoginRequest(BaseModel):
  """Credenciales de acceso."""

  email: str = Field(..., description="Email del usuario")
  password: str = Field(..., description="Contraseña")


class TokenResponse(BaseModel):
  """Token de sesión y datos del usuario autenticado."""

  access_token: str = Field(..., description="Token Bearer de sesión")
  token_type: str = Field("bearer", description="Tipo de token")
  rol: str = Field(..., description="Rol del usuario")
  email: str = Field(..., description="Email del usuario")
  nombre: str = Field(..., description="Nombre del usuario")


class UsuarioResponse(BaseModel):
  """Datos públicos del usuario autenticado (sin hash de contraseña)."""

  id: int = Field(..., description="Identificador del usuario")
  email: str = Field(..., description="Email del usuario")
  nombre: str = Field(..., description="Nombre del usuario")
  rol: str = Field(..., description="Rol del usuario")
  bloqueado: bool = Field(False, description="Si la cuenta está bloqueada")


class BloqueoUpdate(BaseModel):
  """Bloqueo o desbloqueo de un usuario (solo `admin`)."""

  bloqueado: bool = Field(..., description="true para bloquear, false para desbloquear")


class ConfigResponse(BaseModel):
  """Parámetros de la plataforma ajustables por el administrador."""

  penalizacion_completitud_min: float = Field(
      ...,
      description="Factor mínimo de penalización por datos incompletos (0-1]. "
      "1.0 = no penalizar.",
  )
  boost_feedback: float = Field(
      ...,
      description="Factor multiplicativo aplicado a los inmuebles favoritos / "
      "'me gusta' del inquilino en /recommend (>= 1.0). 1.0 = sin boost.",
  )


class ConfigUpdate(BaseModel):
  """Actualización de los parámetros de la plataforma (solo `admin`).

  Ambos campos son opcionales: solo se actualizan los que se envían.
  """

  penalizacion_completitud_min: Optional[float] = Field(
      None,
      gt=0.0,
      le=1.0,
      description="Factor mínimo de penalización (mayor a 0 y hasta 1.0).",
  )
  boost_feedback: Optional[float] = Field(
      None,
      ge=1.0,
      le=2.0,
      description="Boost a favoritos / 'me gusta' (entre 1.0 y 2.0).",
  )


class RolUpdate(BaseModel):
  """Cambio de rol de un usuario (solo `admin`)."""

  model_config = ConfigDict(json_schema_extra={"example": {"rol": "prop_owner"}})

  rol: str = Field(
      ...,
      description="Nuevo rol: admin / prop_owner / real_estate_agent / seeker",
  )
