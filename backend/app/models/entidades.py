"""Modelos ORM (SQLAlchemy 2.0) del dominio.

Tablas:
  - `usuarios`            : cuentas con rol y hash de contraseña.
  - `sesiones`            : credenciales opacas revocables, con vencimiento.
  - `inmuebles`           : catálogo de trabajo. Los bloques anidados del esquema
                            (expensas, edificio, proximidad, contrato, garantias,
                            pension) se guardan como JSON, porque viajan completos
                            y nunca se consultan campo por campo. El ownership
                            (`propietario_email`, `agente_email`) vive aquí y no
                            forma parte del payload público.
  - `feedback`            : favoritos, reacciones e interacciones del inquilino.
  - `perfiles_consultados`: último perfil enviado por cada seeker (necesario para
                            evaluar el ranking con feedback real).
  - `ajustes`             : parámetros que el administrador cambia en caliente.

Las marcas de tiempo (`creado`, `expira`, `actualizado`) son `Float` con
`time.time()`, igual que en el almacén JSON original, para no cambiar la
semántica de expiración de sesiones.
"""

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB

from src.db import Base

TipoJSON = JSON().with_variant(JSONB(), "postgresql")

LONGITUD_EMAIL = 255
LONGITUD_TEXTO = 64


class Usuario(Base):
  __tablename__ = "usuarios"

  id = Column(Integer, primary_key=True, autoincrement=True)
  email = Column(String(LONGITUD_EMAIL), unique=True, nullable=False, index=True)
  nombre = Column(String(LONGITUD_TEXTO), nullable=False)
  rol = Column(String(LONGITUD_TEXTO), nullable=False)
  password_hash = Column(String(255), nullable=False)
  creado = Column(Float, nullable=False)
  bloqueado = Column(Boolean, nullable=False, default=False)


class Sesion(Base):
  __tablename__ = "sesiones"

  token = Column(String(255), primary_key=True)
  usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"),
                       nullable=False, index=True)
  expira = Column(Float, nullable=False)


class Inmueble(Base):
  __tablename__ = "inmuebles"

  id_inmueble = Column(Integer, primary_key=True, autoincrement=False)
  propietario_email = Column(String(LONGITUD_EMAIL), nullable=True, index=True)
  agente_email = Column(String(LONGITUD_EMAIL), nullable=True, index=True)

  lat = Column(Float, nullable=True)
  lon = Column(Float, nullable=True)
  piso = Column(Integer, nullable=True)
  acceso = Column(String(LONGITUD_TEXTO), nullable=True)
  orientacion = Column(String(LONGITUD_TEXTO), nullable=True)
  tipo_unidad = Column(String(LONGITUD_TEXTO), nullable=True)

  tipologia = Column(String(LONGITUD_TEXTO), nullable=True)
  es_monoambiente = Column(Boolean, nullable=True)
  cantidad_habitaciones = Column(Integer, nullable=True)
  cantidad_banos = Column(Integer, nullable=True)
  cantidad_banos_en_suite = Column(Integer, nullable=True)
  cocina_separada = Column(Boolean, nullable=True)
  living_separado = Column(Boolean, nullable=True)
  tiene_lavadero = Column(Boolean, nullable=True)
  lavadero_separado = Column(Boolean, nullable=True)
  balcon_ubicacion = Column(String(LONGITUD_TEXTO), nullable=True)
  ambientes = Column(TipoJSON, nullable=True)
  espacio_home_office = Column(Boolean, nullable=True)
  tiene_patio = Column(Boolean, nullable=True)
  patio_cesped = Column(Boolean, nullable=True)

  precio = Column(Float, nullable=True)
  moneda = Column(String(8), nullable=True)
  moneda_a_convenir = Column(Boolean, nullable=True)
  acepta_mascotas = Column(Boolean, nullable=True)
  tamano_maximo_mascota = Column(String(LONGITUD_TEXTO), nullable=True)
  tiene_cochera = Column(Boolean, nullable=True)
  cochera_techada = Column(Boolean, nullable=True)
  espacio_moto_bicicleta = Column(Boolean, nullable=True)

  expensas = Column(TipoJSON, nullable=True)
  edificio = Column(TipoJSON, nullable=True)
  proximidad = Column(TipoJSON, nullable=True)
  contrato = Column(TipoJSON, nullable=True)
  garantias = Column(TipoJSON, nullable=True)
  pension = Column(TipoJSON, nullable=True)

  titulo = Column(String(255), nullable=True)
  direccion = Column(String(255), nullable=True)
  superficie = Column(Float, nullable=True)
  estado = Column(String(LONGITUD_TEXTO), nullable=True, default="publicado")
  fotos = Column(TipoJSON, nullable=True)


class FeedbackEntrada(Base):
  __tablename__ = "feedback"

  id = Column(Integer, primary_key=True, autoincrement=True)
  usuario_email = Column(String(LONGITUD_EMAIL), nullable=False, index=True)
  id_inmueble = Column(Integer, nullable=False, index=True)
  tipo = Column(String(LONGITUD_TEXTO), nullable=False)
  repeticiones = Column(Integer, nullable=False, default=1)
  creado = Column(Float, nullable=False)
  actualizado = Column(Float, nullable=False)

  __table_args__ = (
    UniqueConstraint("usuario_email", "id_inmueble", "tipo",
                     name="uq_feedback_usuario_inmueble_tipo"),
  )


class PerfilConsultado(Base):
  __tablename__ = "perfiles_consultados"

  usuario_email = Column(String(LONGITUD_EMAIL), primary_key=True)
  perfil = Column(TipoJSON, nullable=False)
  actualizado = Column(Float, nullable=False)


class Ajuste(Base):
  __tablename__ = "ajustes"

  clave = Column(String(LONGITUD_TEXTO), primary_key=True)
  valor = Column(Float, nullable=False)


class Validacion(Base):
  """Validación de una afirmación refutada, con foto y ubicación medidas.

  El dueño/agente sube una foto del punto de interés; la ubicación se toma
  del GPS de la foto (EXIF) y, si no lo tiene, de la enviada por el usuario.
  """
  __tablename__ = "validaciones"

  id = Column(Integer, primary_key=True, autoincrement=True)
  id_inmueble = Column(Integer, nullable=False, index=True)
  detalle = Column(String(LONGITUD_TEXTO), nullable=False)
  foto_url = Column(String(1024), nullable=True)
  lat = Column(Float, nullable=True)
  lon = Column(Float, nullable=True)
  distancia_medida = Column(Float, nullable=True)
  distancia_declarada = Column(Float, nullable=True)
  resultado = Column(String(LONGITUD_TEXTO), nullable=False)
  creado = Column(Float, nullable=False)
