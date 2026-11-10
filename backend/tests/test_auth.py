"""Tests de autenticación, roles y ajustes administrables."""

import time

import pytest
from fastapi import HTTPException

from app.core.dependencias import requiere_roles
from app.core.seguridad import (
    ROL_ADMIN,
    ROL_AGENTE,
    ROL_PROPIETARIO,
    ROL_SEEKER,
    hash_password,
    necesita_rehash,
    validar_password,
    verificar_password,
)
from app.repositories.usuario_repository import RepositorioUsuarios
from app.services import ajuste_service
from app.services.auth_service import ServicioAuth
from src.completeness import factor_penalizacion_completitud



def test_hash_bcrypt_y_verificacion_de_password():
  hash_ = hash_password("Secreto123!")
  assert hash_.startswith("$2b$12$")
  assert verificar_password("Secreto123!", hash_)
  assert not verificar_password("otra-clave", hash_)
  assert not verificar_password("Secreto123!", "hash-invalido")


def test_hashes_del_mismo_password_son_distintos():
  assert hash_password("Misma123!") != hash_password("Misma123!")


def test_hash_pbkdf2_heredado_sigue_verificando_y_se_marca_para_migrar():
  heredado = (
      "pbkdf2_sha256$200000$"
      "00112233445566778899aabbccddeeff$"
      "b4c8d2d59f7e6e3c4ab0a5a2f2e8a0f1d2c3b4a5968778695a4b3c2d1e0f9a8b"
  )
  assert not verificar_password("Secreto123!", heredado)
  assert necesita_rehash(heredado)
  assert not necesita_rehash(hash_password("Secreto123!"))


def test_politica_de_contrasenas():
  assert validar_password("Secreto123!") is None
  assert validar_password("corta1!") is not None
  assert validar_password("secreto123!") is not None
  assert validar_password("SECRETO123!") is not None
  assert validar_password("Secreto!!!") is not None
  assert validar_password("Secreto123") is not None
  assert validar_password("Aa1!" + "x" * 80) is not None


def test_registro_rechaza_password_que_no_cumple_politica(fabrica):
  almacen = _almacen(fabrica)
  with pytest.raises(ValueError):
    almacen.registrar("ana@example.com", "secreto123", "Ana", ROL_SEEKER)


def test_login_migra_hash_heredado_a_bcrypt(fabrica):
  import hashlib

  repo = RepositorioUsuarios(fabrica=fabrica)
  almacen = ServicioAuth(repo)
  usuario = almacen.registrar("ana@example.com", "Secreto123!", "Ana", ROL_SEEKER)

  sal = "00112233445566778899aabbccddeeff"
  derivada = hashlib.pbkdf2_hmac("sha256", b"Secreto123!", bytes.fromhex(sal), 200_000)
  repo.actualizar_password_hash(
      usuario["id"], "pbkdf2_sha256$200000${0}${1}".format(sal, derivada.hex())
  )

  autenticado = almacen.autenticar("ana@example.com", "Secreto123!")
  assert autenticado is not None
  assert repo.por_id(usuario["id"])["password_hash"].startswith("$2b$")
  assert almacen.autenticar("ana@example.com", "Secreto123!") is not None



def _almacen(fabrica):
  return ServicioAuth(RepositorioUsuarios(fabrica=fabrica))


def test_registro_y_autenticacion(fabrica):
  almacen = _almacen(fabrica)
  usuario = almacen.registrar("ana@example.com", "Secreto123!", "Ana", ROL_SEEKER)
  assert usuario["rol"] == ROL_SEEKER
  assert "password_hash" in usuario

  autenticado = almacen.autenticar("ana@example.com", "Secreto123!")
  assert autenticado is not None
  assert autenticado["nombre"] == "Ana"
  assert almacen.autenticar("ana@example.com", "incorrecta") is None
  assert almacen.autenticar("nadie@example.com", "Secreto123!") is None


def test_email_duplicado_falla(fabrica):
  almacen = _almacen(fabrica)
  almacen.registrar("ana@example.com", "Secreto123!", "Ana", ROL_SEEKER)
  with pytest.raises(ValueError):
    almacen.registrar("ANA@example.com", "otraclave1", "Otra", ROL_SEEKER)


def test_password_corta_falla(fabrica):
  almacen = _almacen(fabrica)
  with pytest.raises(ValueError):
    almacen.registrar("ana@example.com", "corta", "Ana", ROL_SEEKER)


def test_email_invalido_falla(fabrica):
  almacen = _almacen(fabrica)
  with pytest.raises(ValueError):
    almacen.registrar("no-es-un-email", "Secreto123!", "Ana", ROL_SEEKER)


def test_no_se_puede_autorregistrar_admin(fabrica):
  almacen = _almacen(fabrica)
  with pytest.raises(ValueError):
    almacen.registrar("jefe@example.com", "Secreto123!", "Jefe", ROL_ADMIN)


def test_persistencia_en_disco(fabrica):
  """Dos instancias sobre la misma base ven lo escrito por la primera."""
  ServicioAuth(RepositorioUsuarios(fabrica=fabrica)).registrar("ana@example.com", "Secreto123!", "Ana")
  recargado = ServicioAuth(RepositorioUsuarios(fabrica=fabrica))
  assert recargado.autenticar("ana@example.com", "Secreto123!") is not None



def test_sesion_token_valido_y_logout(fabrica):
  almacen = _almacen(fabrica)
  usuario = almacen.registrar("ana@example.com", "Secreto123!", "Ana")
  token = almacen.crear_sesion(usuario)

  assert almacen.usuario_por_token(token)["id"] == usuario["id"]
  assert almacen.usuario_por_token("token-inexistente") is None

  almacen.cerrar_sesion(token)
  assert almacen.usuario_por_token(token) is None


def test_token_vencido_se_rechaza(fabrica):
  almacen = _almacen(fabrica)
  usuario = almacen.registrar("ana@example.com", "Secreto123!", "Ana")
  token = almacen.crear_sesion(usuario)
  almacen.caducar_sesion(token)

  assert almacen.usuario_por_token(token) is None


def test_bloquear_revoca_sesiones_y_desbloquear_restaura(fabrica):
  almacen = _almacen(fabrica)
  usuario = almacen.registrar("ana@example.com", "Secreto123!", "Ana")
  token = almacen.crear_sesion(usuario)

  bloqueado = almacen.bloquear(usuario["id"], True)
  assert bloqueado["bloqueado"] is True
  assert almacen.usuario_por_token(token) is None

  assert almacen.obtener(usuario["id"])["bloqueado"] is True

  almacen.bloquear(usuario["id"], False)
  nuevo_token = almacen.crear_sesion(usuario)
  assert almacen.usuario_por_token(nuevo_token)["id"] == usuario["id"]


def test_bloquear_usuario_inexistente(fabrica):
  assert _almacen(fabrica).bloquear(9999, True) is None


def test_sembrar_admin(fabrica):
  almacen = _almacen(fabrica)
  admin = almacen.sembrar_admin()
  assert admin is not None
  assert admin["rol"] == ROL_ADMIN
  assert almacen.sembrar_admin() is None



def test_requiere_roles_sin_credenciales_da_401():
  dependencia = requiere_roles(ROL_ADMIN)
  with pytest.raises(HTTPException) as exc:
    dependencia(usuario=None)
  assert exc.value.status_code == 401


def test_requiere_roles_con_rol_incorrecto_da_403():
  dependencia = requiere_roles(ROL_ADMIN)
  with pytest.raises(HTTPException) as exc:
    dependencia(usuario={"rol": ROL_SEEKER})
  assert exc.value.status_code == 403


def test_requiere_roles_con_rol_permitido_pasa():
  dependencia = requiere_roles(ROL_ADMIN, ROL_AGENTE)
  assert dependencia(usuario={"rol": ROL_AGENTE})["rol"] == ROL_AGENTE
  assert dependencia(usuario={"rol": ROL_ADMIN})["rol"] == ROL_ADMIN


def test_ajustes_admin_cambian_la_penalizacion(fabrica):
  try:
    actualizado = ajuste_service.obtener_servicio_ajustes().actualizar(penalizacion_completitud_min=0.9)
    assert actualizado["penalizacion_completitud_min"] == 0.9
    assert factor_penalizacion_completitud(0) == 0.9
    assert factor_penalizacion_completitud(100) == 1.0
  finally:
    ajuste_service.obtener_servicio_ajustes().actualizar(
        penalizacion_completitud_min=ajuste_service.DEFECTOS["penalizacion_completitud_min"]
    )



def test_listar_usuarios_no_expone_hash(fabrica):
  almacen = _almacen(fabrica)
  almacen.registrar("ana@example.com", "Secreto123!", "Ana", ROL_SEEKER)
  listado = almacen.listar()
  assert len(listado) == 1
  assert "password_hash" not in listado[0]
  assert set(listado[0].keys()) == {"id", "email", "nombre", "rol", "bloqueado"}


def test_cambiar_rol(fabrica):
  almacen = _almacen(fabrica)
  usuario = almacen.registrar("ana@example.com", "Secreto123!", "Ana", ROL_SEEKER)
  actualizado = almacen.cambiar_rol(usuario["id"], ROL_PROPIETARIO)
  assert actualizado["rol"] == ROL_PROPIETARIO
  assert almacen.obtener(usuario["id"])["rol"] == ROL_PROPIETARIO


def test_cambiar_rol_invalido_falla(fabrica):
  almacen = _almacen(fabrica)
  usuario = almacen.registrar("ana@example.com", "Secreto123!", "Ana", ROL_SEEKER)
  with pytest.raises(ValueError):
    almacen.cambiar_rol(usuario["id"], "superadmin")
  with pytest.raises(ValueError):
    almacen.cambiar_rol(usuario["id"], "visitor")


def test_cambiar_rol_inexistente_devuelve_none(fabrica):
  almacen = _almacen(fabrica)
  assert almacen.cambiar_rol(999, ROL_SEEKER) is None


def test_eliminar_usuario_revoca_sesiones(fabrica):
  almacen = _almacen(fabrica)
  usuario = almacen.registrar("ana@example.com", "Secreto123!", "Ana", ROL_SEEKER)
  token = almacen.crear_sesion(usuario)

  assert almacen.eliminar(usuario["id"]) is True
  assert almacen.obtener(usuario["id"]) is None
  assert almacen.usuario_por_token(token) is None
  assert almacen.eliminar(usuario["id"]) is False


def test_sembrar_cuentas_demo(fabrica):
  almacen = _almacen(fabrica)
  creadas = almacen.sembrar_cuentas_demo()
  roles = {cuenta["rol"] for cuenta in creadas}
  assert roles == {ROL_PROPIETARIO, ROL_AGENTE}
  assert almacen.sembrar_cuentas_demo() == []
