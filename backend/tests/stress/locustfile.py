"""Pruebas de estrés del backend con Locust.

Uso (con el stack levantado en Docker):
    venv/bin/python -m locust -f backend/tests/stress/locustfile.py \\
        --host http://localhost:8000 --headless -u 20 -r 5 -t 60s \\
        --csv resultados

Flujos cubiertos:
  - GET /propiedades (catálogo público).
  - GET / (salud).
  - POST /recommend con token de buscador (el flujo más pesado: modelo).

Métricas de recursos mientras corre:
    docker stats proptech-backend-1 proptech-db-1 proptech-seaweedfs-1
"""

import json

from locust import HttpUser, between, task

PERFIL = {
    "presupuesto_max": 250000,
    "moneda_preferida": "ARS",
    "tiene_mascota": True,
    "lat_trabajo": -27.469,
    "lon_trabajo": -58.83,
    "distancia_max_trabajo_km": 5.0,
}


class Buscador(HttpUser):
  """Usuario inquilino que pide recomendaciones (flujo pesado)."""

  wait_time = between(1, 3)
  token = None

  def on_start(self):
    respuesta = self.client.post(
        "/auth/login",
        json={"email": "buscador@proptech.local", "password": "buscador12345"},
    )
    if respuesta.status_code == 200:
      self.token = respuesta.json().get("access_token")

  @task(5)
  def recomendar(self):
    cabeceras = {"Authorization": f"Bearer {self.token}"} if self.token else {}
    self.client.post("/recommend?top_k=5", json=PERFIL, headers=cabeceras)

  @task(2)
  def catalogo(self):
    self.client.get("/propiedades")

  @task(1)
  def salud(self):
    self.client.get("/")


class Visitante(HttpUser):
  """Usuario anónimo que navega el catálogo público."""

  wait_time = between(2, 5)

  @task
  def catalogo(self):
    self.client.get("/propiedades")

  @task
  def detalle(self):
    self.client.get("/propiedades/101")
