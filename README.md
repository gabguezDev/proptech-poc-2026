# Aplicación Web de Recomendación Inteligente de Alquileres

Monorepo del proyecto final de Licenciatura en Informática: **backend FastAPI +
PostgreSQL** y **frontend Next.js con BFF**, levantables juntos con Docker.

PoC de una **API de recomendación inteligente de inmuebles** (PropTech),
desarrollada como proyecto final de Licenciatura en Informática.

La API recibe el **perfil completo de preferencias y hábitos del inquilino**,
aplica **filtros duros**, calcula **features de compatibilidad** y devuelve un
**ranking de inmuebles** con un `score_compatibilidad` (0–100) ponderado por los
pesos que el usuario elige.

## Stack

**Backend** (`backend/`)

- **Python 3.9** + **FastAPI** + **Pydantic v2** (API y validación de esquemas)
- **pandas / numpy** (manipulación de datos) y **scikit-learn** (modelos alternativos)
- **LightGBM** (modelo activo: `LGBMRanker` por destilación; requiere `libomp`,
  que en la imagen de Docker viene como `libgomp1`)
- **PostgreSQL + SQLAlchemy 2.0** (usuarios, sesiones, catálogo, feedback, ajustes)
- **Autenticación por roles**: PBKDF2 + credenciales de sesión opacas y revocables

**Frontend** (`frontend/`)

- **Next.js 16** (App Router) + **TypeScript** + **React 19**
- **BFF**: los route handlers de `frontend/src/app/api/*` son el único cliente del
  backend; el navegador solo recibe una cookie `httpOnly`

**Desarrollo**

- **Docker Compose**: base + backend + frontend con un solo comando

## Estructura

```
repo/
├── docker-compose.yml             # db + backend + frontend, con hot-reload
├── docker-compose.prod.yml        # overrides de producción (imágenes compiladas)
├── scripts/dev.sh                 # levantar todo          → http://localhost:3000
├── scripts/build.sh               # reconstruir imágenes (--prod, por servicio)
├── backend/
│   ├── main.py                    # App FastAPI: lifespan + routers por capa.
│   ├── Dockerfile                 # etapas dev / prod
│   ├── data/mock_properties.json  # Catálogo sintético (11 inmuebles; el 111 está incompleto a propósito). SEMILLA inmutable.
│   ├── app/                       # Capas: core · models · repositories · services · schemas · controllers · utils
│   │   ├── core/                  # seguridad (roles/PBKDF2) · dependencias FastAPI · cuentas semilla · datos demo
│   │   ├── models/entidades.py    # Modelos ORM: usuarios, sesiones, inmuebles, feedback, ajustes.
│   │   ├── repositories/          # Acceso a datos (SQLAlchemy, sin reglas)
│   │   ├── services/              # Reglas de negocio: auth · inmuebles · feedback · ajustes · recomendación · métricas
│   │   ├── schemas/               # Contrato Pydantic (auth · inmueble · recomendación · feedback · métricas)
│   │   ├── controllers/           # HTTP: auth · inmuebles · feedback · recomendaciones · admin · sistema
│   │   └── utils/presentacion.py  # score_carga y respuestas
│   ├── src/                       # Dominio numérico (modelos, completitud, evaluación; sin FastAPI)
│   │   ├── config.py              # Constantes: rutas, features, dimensiones, pesos.
│   │   ├── db.py                  # Motor y sesiones (PostgreSQL por DATABASE_URL, SQLite si no).
│   │   ├── data_loader.py         # Carga la semilla a un DataFrame.
│   │   ├── completeness.py        # Score de carga (completitud) del inmueble.
│   │   ├── feedback_tipos.py      # Tipos de feedback y grados de relevancia.
│   │   ├── utils.py               # clasificar_distancia() / clasificar_proximidad().
│   │   ├── metrics.py             # Métricas puras de ranking (P@K, R@K, NDCG@K, MAP, MRR, Spearman).
│   │   ├── evaluacion.py          # Evaluación offline: oráculo de utilidad latente + comparación.
│   │   ├── train_lgbm.py          # Entrenamiento del LGBMRecommender (ranker, destilación).
│   │   ├── evaluar_modelos.py     # CLI de evaluación de ranking (guarda artifacts/metricas_ranking.json).
│   │   ├── evaluar_fidelidad.py   # CLI de fidelidad alumno↔maestro (Spearman/Kendall/Top-K).
│   │   └── models/                # content_model (maestro) · cosine_model · lgbm_model (activo)
│   └── tests/                     # pytest; el fixture `fabrica` aísla una base por test.
└── frontend/
    ├── Dockerfile                 # etapas dev / prod (build + standalone)
    └── src/
        ├── proxy.ts               # Next 16: reemplaza a `middleware` (rutas privadas)
        ├── lib/                   # env · api (cliente server-side) · sesion · respuesta · tipo
        ├── app/page.tsx           # Estado del stack
        ├── app/ingresar/          # Acceso y registro (formulario + server actions)
        ├── app/recomendaciones/   # Ranking con desglose por dimensión (XAI)
        ├── app/descartados/       # Zona de descartados y reversión
        └── app/api/               # BFF: auth/*, recomendaciones, propiedades, feedback, sesion
```

## Cómo ejecutar

```bash
# Subir todo el stack (base de datos + backend + frontend)
./scripts/dev.sh

# Reconstruir imágenes (cambió requirements.txt, package.json o un Dockerfile)
./scripts/build.sh                 # desarrollo
./scripts/build.sh --prod          # artefacto de producción
```

| Servicio | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend (Swagger) | http://localhost:8000/docs |
| PostgreSQL | localhost:5433 |

Cuentas sembradas al primer arranque (se cambian en `.env`, ver `.env.example`):
`admin@proptech.local` · `dueno@proptech.local` · `agente@proptech.local` ·
`buscador@proptech.local` (todas con contraseña `…12345`).

**Backend sin Docker** (usa SQLite local):

```bash
cd backend && pip install -r requirements.txt && uvicorn main:app --reload
```

**Tests** (desde la raíz del repo):

```bash
venv/bin/python -m pytest -q
```

### Frontend y BFF

- La pantalla solo ve una **cookie `httpOnly`**: `lib/api.ts` (servidor) es el
  único lugar que maneja la credencial del backend, y los handlers de
  `app/api/auth/*` responden únicamente `{email, nombre, rol}`.
- Next 16 con **Cache Components**: no se usa `export const dynamic`; el acceso a
  datos de request va dentro de `<Suspense>` (o `connection()` en los `GET` que no
  leen cookies). `src/proxy.ts` reemplazó a `middleware.ts`.
- El estado global lo define el backend en cada request: el proxy solo decide qué
  pantalla se muestra.

### Endpoints

| Método | Ruta           | Rol requerido | Descripción                                                        |
|--------|----------------|---------------|--------------------------------------------------------------------|
| GET    | `/`            | público       | Health check.                                                      |
| POST   | `/auth/registro` | público     | Crea un usuario (`seeker`/`prop_owner`/`real_estate_agent`) y devuelve un token. |
| POST   | `/auth/login`  | público       | Login (email + contraseña) → token Bearer.                         |
| POST   | `/auth/logout` | autenticado   | Invalida el token actual.                                          |
| GET    | `/auth/me`     | autenticado   | Datos del usuario autenticado.                                     |
| GET    | `/propiedades` | público       | Catálogo de inmuebles (esquema `Inmueble`), con `score_carga`.     |
| GET    | `/mis-inmuebles` | `prop_owner` / `real_estate_agent` / `admin` | Inmuebles que gestiona el usuario (con ownership).    |
| POST   | `/propiedades` | `prop_owner` / `real_estate_agent` / `admin` | Dar de alta un inmueble (asigna la propiedad según el rol). |
| PUT    | `/propiedades/{id_inmueble}` | `prop_owner` / `real_estate_agent` / `admin` | Editar / completar un inmueble propio.        |
| GET    | `/propiedades/{id_inmueble}/completitud` | `prop_owner` / `real_estate_agent` / `admin` | Detalle del score de carga (qué falta cargar). |
| POST   | `/recommend`   | `seeker` / `admin` | Perfil del usuario (`UserPreferences`) → ranking (`RecommendResponse`). |
| GET    | `/admin/config` | `admin`       | Ver la configuración de la plataforma.                            |
| PUT    | `/admin/config` | `admin`       | Ajustar el factor de penalización por datos incompletos.          |
| GET    | `/admin/usuarios` | `admin`     | Listar usuarios registrados.                                       |
| PUT    | `/admin/usuarios/{id}/rol` | `admin` | Cambiar el rol de un usuario.                             |
| DELETE | `/admin/usuarios/{id}` | `admin`     | Dar de baja un usuario (revoca sus sesiones).                      |
| GET    | `/admin/metricas` | `admin`     | Métricas de ranking (P@K, R@K, NDCG@K, MAP, MRR, Spearman) por modelo. |

## Roles y autenticación

La API usa **registro/login con usuarios, contraseñas hasheadas y tokens Bearer**
(implementado solo con la librería estándar: `hashlib` PBKDF2-HMAC-SHA256 y
tokens opacos de `secrets`).

| Rol | Quién es | Puede |
|---|---|---|
| `admin` | Administrador de la plataforma | Todo: config, usuarios y gestionar cualquier inmueble |
| `prop_owner` | Dueño de la propiedad | Crear/editar **sus** inmuebles y ver su completitud |
| `real_estate_agent` | Agente inmobiliario | Crear/editar los inmuebles de su **cartera** y ver su completitud |
| `seeker` | Busca alquilar (registrado) | Pedir recomendaciones (`/recommend`) |
| `visitor` | No registrado | Solo el catálogo público (`/propiedades`) |

- El rol `admin` **no** puede autorregistrarse: se siembra al arrancar (email
  `admin@proptech.local`, contraseña `admin12345`, configurables por las
  variables de entorno `ADMIN_EMAIL` / `ADMIN_PASSWORD`). También se siembran las
  cuentas demo de propietario (`dueno@proptech.local` / `dueno12345`) y agente
  (`agente@proptech.local` / `agente12345`).
- Los usuarios y sus sesiones (credenciales opacas con vencimiento) viven en las
  tablas `usuarios` y `sesiones` de PostgreSQL.
- Para endpoints protegidos, enviar el header `Authorization: Bearer <token>`.
  Sin credenciales se asume `visitor` (401 si el rol no alcanza; 403 si el rol
  no tiene permiso).

### Propiedad de inmuebles (ownership)

El catálogo público (`data/mock_properties.json`) es la **semilla inmutable**. Al
primer arranque, si la tabla `inmuebles` está vacía, se carga desde esa semilla:
`inmuebles` es el **catálogo de trabajo editable**. Cada inmueble registra su
`propietario_email` /
`agente_email`; esos campos **no** se exponen en el catálogo público. En la
semilla, las propiedades 101–103 quedan a nombre del propietario demo, 104 es
co-gestionada (propietario + agente) y 105–106 quedan a cargo del agente.

```bash
# El propietario demo lista lo suyo
curl http://127.0.0.1:8000/mis-inmuebles -H "Authorization: Bearer $TOKEN_DUENO"

# Da de alta un inmueble (queda a su nombre) y luego lo completa
curl -X POST http://127.0.0.1:8000/propiedades \
  -H "Authorization: Bearer $TOKEN_DUENO" -H "Content-Type: application/json" \
  -d '{"precio":180000,"moneda":"ARS","moneda_a_convenir":false,"tipologia":"monoambiente",
       "es_monoambiente":true,"cantidad_habitaciones":0,"cantidad_banos":1,
       "cantidad_banos_en_suite":0,"piso":2,"orientacion":"frente","tipo_unidad":"edificio",
       "cocina_separada":false,"living_separado":false,"tiene_lavadero":false,
       "lavadero_separado":false,"balcon_ubicacion":"no_tiene","espacio_home_office":false,
       "acepta_mascotas":true,"tiene_cochera":false,"cochera_techada":false,
       "lat":-27.470,"lon":-58.831}'
```

### Flujo de uso

```bash
# 1. Registrarse como buscador y guardar el token
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/auth/registro \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@example.com","password":"secreto123","rol":"seeker"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# 2. Pedir recomendaciones con el token
curl -X POST "http://127.0.0.1:8000/recommend?top_k=3" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"presupuesto_max":250000,"lat_trabajo":-27.469,"lon_trabajo":-58.830}'
```

## Configuración del administrador

El parámetro `penalizacion_completitud_min` (cuánto se penaliza, como mínimo, un
inmueble con datos incompletos) es **exclusivo del rol `admin`** y se ajusta en
caliente:

```bash
curl -X PUT http://127.0.0.1:8000/admin/config \
  -H "Authorization: Bearer <TOKEN_ADMIN>" -H "Content-Type: application/json" \
  -d '{"penalizacion_completitud_min": 0.8}'
```

Se persiste en la tabla `ajustes` y se aplica al instante en `/recommend`.

## Modelos de recomendación

- **`LGBMRecommender`** *(ACTIVO, `src/models/lgbm_model.py`)*: un **`LGBMRanker`**
  de LightGBM (*learning to rank*) entrenado por **destilación** del
  `ContentRecommender` (ver abajo). Es el recomendador que usa la API por defecto;
  si no está el `.pkl`, entrena al vuelo (cold start). La salida del ranker se
  **calibra con una regresión isotónica** a la escala 0–100 del maestro.
- **`ContentRecommender`** *(maestro / MVP de respaldo)*: filtros duros +
  ingeniería de features + score ponderado por los pesos del usuario. Es el
  **maestro** de la destilación y el fallback si no hay `libomp`. Devuelve
  sub-scores por dimensión (precio, ubicación, hábitos/confort, amenities,
  garantías) para **explicabilidad (XAI)**.
- **`CosineRecommender`** *(alternativo)*: similitud de coseno (scikit-learn).

## Score de carga (completitud del inmueble)

Además del score de compatibilidad (lado **inquilino**), existe un **score de
carga** (lado **propietario**): mide qué tan completa está la información que
cargó quien publica el inmueble. **A mayor carga, mayor probabilidad de
matchear.**

- Se calcula en `src/completeness.py`: `100 × Σ(peso × campo_cargado) / Σ(peso)`
  (0–100), ponderando cada campo por su relevancia.
- Agrupado en `precio`, `ubicacion`, `fisico`, `servicios`, `garantias`,
  `contrato`, `edificio`, `pension`.
- **Críticos** (`precio`, `moneda`, `lat`, `lon`, `tipologia`, `acepta_mascotas`):
  si falta alguno, el score se **topea en 40** (el inmueble casi no puede
  matchear).
- Los bloques **condicionales** (`edificio` solo si `tipo_unidad == "edificio"`;
  `pension` solo si `tipologia == "pension"`) no penalizan si no aplican.

### Cómo se expone

- `GET /propiedades` incluye `score_carga` en cada inmueble.
- `GET /propiedades/{id_inmueble}/completitud` devuelve el detalle: score por
  grupo y la **lista de campos faltantes** (para decirle al propietario qué
  completar).

### Penalización de la compatibilidad

Un inmueble con datos faltantes tiene menos chance de matchear, así que su
`score_compatibilidad` se multiplica por un `factor_completitud` (entre
`penalizacion_completitud_min` y `1.0`). Por eso, en `/recommend`, cada
resultado incluye `score_carga` y `factor_completitud` además del score final.

El mínimo (`0.5` por defecto) es un **parámetro de gobernanza**: solo un
`admin` puede cambiarlo (ver *Configuración del administrador*). El factor
escala linealmente con el score de carga: `min + (1 - min) · (score_carga / 100)`.

> El catálogo incluye la propiedad **111** como ejemplo de **carga incompleta**
> (score de carga ≈ 52.7) para demostrar el ranking penalizado.

## Entrenamiento por destilación (maestro → alumno)

### ¿Qué es la destilación?

La **destilación de conocimiento** (*knowledge distillation*) es una técnica de
ML donde un **modelo maestro** (teacher) transfiere su conocimiento a un **modelo
alumno** (student). El alumno no aprende de "datos crudos", sino que **imita las
salidas del maestro**.

### ¿Por qué la usamos?

Porque **no hay datos de interacción reales** (ningún usuario dijo "este inmueble
me gustó"). Sin etiquetas, LightGBM no tendría nada que aprender.

El `ContentRecommender` resuelve esto: es un modelo **determinista de reglas +
pesos que NO necesita entrenarse**, así que funciona como un **oráculo** capaz de
etiquetar infinitos casos sin haber aprendido de nadie.

> **"Destilar el `ContentRecommender`"** = usarlo como **maestro** para generar
> las etiquetas (orden + score) con las que se entrena el ranker.

```
ContentRecommender (maestro: reglas + pesos, no entrena)
        │  genera un score continuo 0-100 por candidato
        ▼
   dataset (X, y, grupos)   ← perfiles sintéticos
        │  y = grados de relevancia (cuantiles dentro del perfil)
        │  grupos = un perfil por query
        │  .fit()  (objetivo lambdarank)
        ▼
LGBMRanker (alumno: sí entrena)  →  aprende a ORDENAR como el maestro
        │  calibración isotónica (puntaje crudo → 0-100)
        ▼
   score_compatibilidad calibrado (0-100)
```

### Pasos en el código

| Paso | Función | Rol |
|---|---|---|
| 1. Inventar usuarios | `generar_perfiles_sinteticos()` | Crea perfiles plausibles (presupuesto, garantías, hábitos, pesos). |
| 2. El maestro etiqueta | `ContentRecommender.predict()` | Calcula el `score_compatibilidad` (0–100) por candidato. |
| 3. Armar features y grados | `LGBMRecommender.construir_dataset()` | Convierte cada par (usuario, inmueble) en `X`, el score en **grados** (`grados_por_cuantiles`) y arma los **grupos**. |
| 4. Entrenar alumno | `LGBMRecommender.train()` | `LGBMRanker.fit(X, y, group=...)` (objetivo `lambdarank`). |
| 5. Calibrar | `LGBMRecommender.calibrar()` | Regresión isotónica: puntaje crudo → escala 0–100 del maestro. |
| 6. Usar | `LGBMRecommender.predict()` | Ordena y devuelve scores calibrados para usuarios nuevos. |

### Entrenar

Requiere `libomp` instalado (en macOS: `brew install libomp`).

```bash
venv/bin/python -m src.train_lgbm
```

Genera perfiles sintéticos, entrena el ranker por destilación, calibra la salida
a 0–100, imprime las métricas (Spearman / MAE) e importancia de variables, y
guarda el modelo en `artifacts/lgbm_recommender.pkl` (ranker **y** calibrador).

Este es el **modelo activo**: `main.py` carga el `.pkl` al arrancar y, si no
existe, entrena al vuelo (cold start). Para volver al MVP `ContentRecommender`
(no requiere `libomp`), comentar el bloque del LGBM y descomentar el del
`ContentRecommender` en la sección "SELECCIÓN DEL MODELO" de `main.py`.

### Qué gana y qué NO el alumno

**Gana:**

- Un **ranker** nativo de LightGBM **entrenado** de verdad (no una receta fija).
- **Importancia de variables** nativa (XAI).
- **Mejor orden** que el maestro según las métricas de ranking (NDCG, Precision@K).
- Base para hacer *fine-tuning* con datos reales en el futuro.

**NO gana:**

- **No supera al maestro en fidelidad puntual**: su techo es el `ContentRecommender`.
- **No descubre preferencias nuevas**: hereda sus sesgos.
- El ranker optimiza el **orden**, no el valor exacto: el puntaje crudo es
  **relativo a cada consulta**, así que el score calibrado (0–100) es una
  aproximación (por eso el Spearman de test es ~0.89 y no 1.0).

> **Analogía**: el `ContentRecommender` es un profesor que conoce las reglas y
> resuelve cualquier ejercicio al instante. Arma un cuaderno con ~1136 ejercicios
> ya resueltos (ordenados de mejor a peor); LightGBM es el alumno que estudia ese
> cuaderno y aprende a **ordenar** ejercicios nuevos parecidos. No es más sabio
> que el profesor, pero ahora es un modelo estadístico generalizable, no una
> receta fija.

### Para la tesis

Permite cumplir el verbo **"entrenar"** de forma **técnicamente correcta y
reproducible**, sin depender de datos que no existen, y deja preparado el camino
para cuando haya feedback real. Es una decisión metodológica defendible: *"ante
la ausencia de interacciones, se optó por un esquema de destilación
maestro-alumno"*.

## Evaluación del ranking (offline, sintética)

Como **no hay feedback real de usuarios**, la calidad del ranking se mide con un
**oráculo sintético de utilidad latente** (`src/evaluacion.py`): por cada perfil
sintético se muestrean **pesos ocultos** (distintos de los declarados) + **ruido**
irreducible, y se calcula una *utilidad verdadera* (0-1) sobre las features
derivadas. La relevancia es graduada (la utilidad) y binaria (el top 30 %). Se
reportan métricas estándar por modelo:

- **Precision@K**, **Recall@K**, **NDCG@K**, **MAP**, **MRR** y **Spearman**
  (score del modelo vs. utilidad verdadera).

Como el ruido es irreducible, ningún modelo acierta perfecto y las métricas quedan
en (0, 1), lo que permite comparar de forma justa. Las métricas son **puras**
(`src/metrics.py`) y están testeadas.

```bash
# Evalúa Content vs LGBM (sobre la SEMILLA, determinista) y guarda
# artifacts/metricas_ranking.json
venv/bin/python -m src.evaluar_modelos
```

Con la API levantada, un `admin` también puede verlo en vivo (sobre el catálogo de
trabajo):

```bash
curl "http://127.0.0.1:8000/admin/metricas?perfiles=200" \
  -H "Authorization: Bearer $TOKEN_ADMIN"
```

> **Limitación**: es una evaluación **sintética** (mide coherencia con el oráculo,
> no con usuarios reales). Solo se comparan `ContentRecommender` y
> `LGBMRecommender`; el `CosineRecommender` queda fuera porque su interfaz recibe
> un vector crudo, no un perfil.

## Tests

```bash
venv/bin/python -m pytest -q
```

Los tests del `LGBMRecommender` se **saltean** automáticamente si LightGBM (o
`libomp`) no está disponible.

## Ejemplo de request

Requiere token de un usuario con rol `seeker` (ver *Flujo de uso*):

```bash
curl -X POST "http://127.0.0.1:8000/recommend?top_k=3" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "presupuesto_max": 250000,
    "tiene_mascota": true,
    "requiere_cochera": true,
    "prefiere_cochera": true,
    "hace_home_office": true,
    "nivel_tolerancia_ruido": "bajo",
    "frecuencia_lavado": "media",
    "lat_trabajo": -27.469,
    "lon_trabajo": -58.830,
    "distancia_max_trabajo_km": 5.0,
    "pesos_usuario": {"precio": 0.30, "ubicacion": 0.30, "habitos_confort": 0.15, "amenities": 0.15, "garantias": 0.10}
  }'
```
