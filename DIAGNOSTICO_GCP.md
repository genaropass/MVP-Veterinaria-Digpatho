# Diagnóstico de escalabilidad — DigpathoVet

Revisión del código (frontend Next.js + backend FastAPI) **antes de subir a GCP**.

Enfoque: qué impide desplegar, qué se rompe al primer usuario concurrente, y qué hay que cambiar ahora que todavía se puede.

- Fuente: código local del repo `DigPathoVet`
- Tipo: revisión estática
- Fecha: 19 ago 2026
- Conteo: **10 P0** · **12 P1** · **10 P2** · **6 OK** (no es un score de calidad)

---

## El bloqueo no es GCP: el repo no es un solo producto

El README y `backend/app/main.py` describen un MVP de citología veterinaria (filtro de calidad + Cellpose). El frontend y gran parte del backend son una copia de **DigpathoWeb** (patología humana): WSI, HER2/Ki67, bots, Zammad, Prisma de pacientes con DNI, deploys SSH a `/opt/digpatho/DigpathoWeb`, y URLs por defecto a `api.digpatho.com`.

Las rutas de usuarios del backend están **comentadas**, así que el login de NextAuth apunta a un endpoint que este API **no monta**.

Hasta que no se recorte el producto, cualquier deploy a GCP copia deuda de DigpathoWeb y deja el MVP vet a medias.

**Ruta corta:** un API de inferencia + un front de dashboard clínico + un Postgres + imágenes en GCS + Cellpose **fuera** del request HTTP.

### No reconectar `app/api/*` de DigpathoWeb

El backend legado (users, pacientes con DNI, Ki67/HER2, WSI, tiles, bots, Zammad) está en el disco pero **no está montado a propósito**: `main.py` es el MVP vet.

Volver a registrar esas rutas “para que el front compile” reintroduce PHI humano, jobs en RAM, disco `/tmp` y endpoints sin tenant.

**Para DigpathoVet hay que recortar el front, no restaurar el API humano.**

---

## Qué hay que decidir primero

| Capa | Lo que el MVP dice ser | Lo que el código es |
|------|------------------------|---------------------|
| Frontend | Dashboard vet + landing | DigpathoWeb completo: profile, WSI, HER2, Ki67, bots, admin, debug, test-upload |
| Backend vivo | `POST /api/v1/analyze-smear` | Solo eso está montado en `main.py`. El resto de `app/api/*` no se incluye |
| Auth | Usuarios veterinarios | NextAuth llama `/users_login/` + Prisma Auth.js; esas rutas están comentadas en `main.py` |
| Datos | Paciente (especie, raza, edad) | Dos Prisma: `User`/`Session` (front) vs `Usuario`/`Paciente.dni` (back, dominio humano) |
| Deploy | GCP | GitHub Actions → SSH + PM2/systemd a VMs. Sin Dockerfile ni Cloud Run |

---

## P0 — No subir a GCP sin esto

| ID | Área | Hallazgo | Qué pasa en GCP |
|----|------|----------|-----------------|
| **P0-1** | Producto | Frontend y workflows siguen siendo DigpathoWeb (`package.json`, PM2 name, rsync a `/opt/digpatho/DigpathoWeb`, `NEXT_PUBLIC_API_URL=https://api.digpatho.com/`) | El build de vet pega al API de producción humana, o el deploy pisa la VM equivocada |
| **P0-2** | Auth rota | `add_user_routes` está comentado en `main.py`. NextAuth (`auth.ts`) y `usersService.ts` llaman `/users_login/` | Login, registro y session JWT no tienen backend. El grupo `(private)` no protege `/dashboard` |
| **P0-3** | CORS | `allow_origins=["http://localhost:3000"]` en `main.py` | El browser en Cloud Run / Load Balancer bloquea todas las llamadas al API |
| **P0-4** | Inferencia | Cellpose corre síncrono dentro del POST (`segmentar_imagen`), `gpu=False`, modelo en memoria global. `cellpose` **no está** en `requirements.txt`. Se usa `opencv-python` (no headless) | La imagen Cloud Run no instala el modelo; si se instala, el request bloquea el event loop, OOM y timeout. `libGL` falta en distroless |
| **P0-5** | Abuso | `analyze-smear` sin auth, sin tope de tamaño, limiter creado pero no aplicado al endpoint. Lee el archivo entero a RAM | Cualquiera satura CPU/RAM del servicio. Cloud Run escala a costo y se cae |
| **P0-6** | Superficie | Rutas públicas: `/api/debug/login` (password en query), `/api/debug/session` (filtra JWT), `/api/debug/register`, `db-ping`, `config`, `/test-upload`, `POST /api/wsi/analyze-region` (proxy sin auth a `api.digpatho.com`) | Credenciales en logs del LB, JWT filtrado, upload abierto. `analyze-region` pega al producto humano |
| **P0-7** | Empaquetado | No hay Dockerfile, docker-compose, cloudbuild ni Terraform. Health es `{status: healthy}` sin chequear modelo | No hay artefacto reproducible. El LB marca healthy un proceso que no puede inferir |
| **P0-8** | URLs duales | Dashboard usa `NEXT_PUBLIC_API_URL ?? localhost:8000`. `constants.ts` default `api.digpatho.com`. `next.config` reescribe `/tiles` a `localhost:8000`. `serverActions.allowedOrigins = app.digpatho.com` | En prod, parte del front habla con el producto humano, parte con localhost de la VM. Server Actions rechazan el host de vet |
| **P0-9** | Secretos | `API_TOKEN` cae a `NEXT_PUBLIC_API_TOKEN`. El JWT del backend va en `session.accessToken` al browser. `deploy.local.env.example` tiene `GCP_PROJECT`, IP `34.23.82.181` y `SSH_USER` de DigpathoWeb | Token de servicio en el bundle. XSS roba el JWT. Infra de otro producto queda en git |
| **P0-10** | Prisma huérfano | El front corre `prisma generate` en cada build. El schema `User`/`Session` solo lo usa `/api/debug/db-ping`. `@auth/prisma-adapter` no está cableado: NextAuth es JWT | Cloud SQL extra, migraciones que no deben correr contra el API, build acoplado a Accelerate/Supabase |

---

## P1 — Se rompe al primer intento de escala

| ID | Área | Hallazgo | Impacto |
|----|------|----------|---------|
| **P1-1** | IA sync | El endpoint es `async` pero llama OpenCV/Cellpose en el mismo hilo. `gunicorn_conf.py` fuerza 1 worker porque el estado de tareas vive en RAM (legado WSI) | 1 análisis a la vez. Más réplicas no comparten cola. Cloud Run `concurrency > 1` congela latencia |
| **P1-2** | Clínica | `main.py` inventa conteos: neutro 60%, linfo 30%, etc. El dashboard los pinta con rangos de referencia como si fueran reales | Riesgo médico/legal. No se puede mostrar esto a veterinarios en un entorno GCP con usuarios reales |
| **P1-3** | Estado | Paciente + análisis solo en `useState`. Sin persistencia, sin GCS, sin historial. preview `ObjectURL` no se revoca | Cloud Run es efímero: no hay disco local útil. Recargar pierde el caso. Fuga de memoria en el browser |
| **P1-4** | Dos bases | Front: `POSTGRES_URL` + `DIRECT_URL` + Prisma Accelerate (`User`/`Session`). Back: `DATABASE_URL` + Prisma Python (`Usuario`/`Paciente`/`Informe` humano). `db.py` instancia `Prisma()` sin `connect()` en el app vivo | Cloud SQL no tiene un dueño. Migraciones duplicadas. Auth y dominio clínico no se cruzan |
| **P1-5** | Build mudo | `next.config`: `eslint.ignoreDuringBuilds` y `typescript.ignoreBuildErrors`. `bodySizeLimit` / `middlewareClientMaxBodySize` = **50gb** | Deploys verdes con tipos rotos. Un POST de 50 GB tumba el servicio y la factura |
| **P1-6** | Proxy / IP | `ProxyHeadersMiddleware trusted_hosts=["127.0.0.1"]`. SlowAPI usa `get_remote_address` | Detrás de Cloud Load Balancing todas las IPs parecen la del proxy. Rate limit inútil o bloquea el LB |
| **P1-7** | Admin | Cookie `admin_session = "authenticated"` (valor fijo, sin firma HMAC). Comparación de `ADMIN_PASSWORD` en texto plano | Cualquiera puede forjar la cookie. El panel `/admin` queda abierto |
| **P1-8** | Proceso | `ecosystem.config.cjs`: instances 1, `max_memory_restart` 500M, nombre `digpatho-web`. `worker.py` importa `process_image` que **no existe** | Next se reinicia bajo carga. El worker legado ni arranca. No hay autoscaling real |
| **P1-9** | Dominio de datos | Schema backend: `dni`, sexo humano, bots (`Interconsulta`, `Capsula`, `Foro`). El vet necesita tutor, mascota, especie, raza, hemograma, estudio de frotis | No se puede migrar ese schema a Cloud SQL y usarlo. Hay que modelar de cero el dominio vet |
| **P1-10** | Observabilidad | `logging.basicConfig`. Sin request-id, sin JSON logs, sin métricas de latencia/OOM/cola. `logging_config.py` existe y no está cableado | Cloud Logging no se puede filtrar. Incidentes de inferencia son ciegos |
| **P1-11** | Si se remonta el API legado | Jobs/uploads en dicts de RAM (por eso gunicorn `workers=1`). WSI a `/tmp`. OpenSlide abre el slide en cada tile. Listas sin paginación ni filtro por usuario. `POST /paciente/` y `GET /users/` sin auth. `Paciente.dni` unique global | Cloud Run con 2 instancias: `/result/{task_id}` 404. Disco efímero lleno. Fuga de casos entre veterinarios. **No hacer esto: recortar, no restaurar** |
| **P1-12** | BFF WSI | El proxy tiles-v2 buffera `arrayBuffer` entero. `/api/wsi/upload` buffera el archivo por Next. `maxDuration` 900. PM2 500M. CI usa Node 18 (EOL) | Cloud Run timeout/memoria. El patrón bueno es upload directo a GCS + tiles firmadas; el proxy Next no escala |

---

## Detalle por sistema

### Inferencia Cellpose — no cabe en un HTTP request (P0)

`POST /api/v1/analyze-smear` lee toda la imagen a memoria, corre `check_image_quality` y después `model.eval` de Cellpose cyto3 en CPU. Luego itera cada máscara con `findContours`. Eso es CPU-bound y **no se offloadea** a un thread pool.

`get_cellpose_model()` guarda el modelo en un global: en Cloud Run cada instancia paga el cold start (cientos de MB, decenas de segundos). `gpu=False` desperdicia si más adelante hay GPU. Si Cellpose no está instalado, el servicio **miente** con una célula simulada y el front no lo distingue.

**Target GCP:** request HTTP corto (upload a GCS + encolar) → Cloud Tasks / Pub/Sub → worker GPU (Cloud Run GPU, GCE o Vertex AI custom) → resultado en Cloud SQL + JSON en GCS. El front hace polling o espera un `job_id`.

### Auth y superficie pública (P0)

- Middleware protege `/profile`, `/settings`, `/wsi`, `/bots`.
- **No protege** `/dashboard` ni `/test-upload`. El nombre `(private)` en App Router **no autentica nada**.
- `/api/debug/login` acepta GET con password en query (queda en logs del LB).
- `/api/debug/session` devuelve el JWT.
- `/api/wsi/analyze-region` reenvía el body a `api.digpatho.com` **sin sesión**.
- Cookie de admin no firmada.
- SHA-256+salt en `frontend/src/lib/utils.ts` no es un KDF (el back sí usa bcrypt, pero esas rutas no están vivas).
- Google/GitHub guardan el token del proveedor, no el JWT del API.

### Datos y persistencia (P1)

- El motor clínico (`analisis.ts` + JSON de referencia) es lo más sólido del repo, pero corre **solo en el cliente**. No hay tabla de estudios, ni archivo de imagen, ni auditoría vet.
- GCS ya está en `requirements.txt` y hay helpers en `app/api/image/service.py` (código muerto del producto humano, **reutilizable**).
- El WSI `ingesta-wsi.py` escribe thumbnails en `backend/data/` (disco local).
- Un Cloud SQL Postgres con schema vet (`Usuario`, `Tutor`, `Mascota`, `Estudio`, `Hallazgo`) reemplaza a los dos Prisma.
- NextAuth puede quedarse con tablas `Account`/`Session` en la misma base, o pasar a Identity Platform.

---

## P2 — Higiene (hacer después de recortar)

| ID | Hallazgo |
|----|----------|
| **P2-1** | Borrar o aislar código muerto: bots, zammad, ki67, tiles, `queue.py`, `worker.py`, prisma humano, workflows de DigpathoWeb |
| **P2-2** | `file.content_type` puede ser `None` → crash en `startswith`. Validar magic bytes y tope (p. ej. 20 MB para frotis) |
| **P2-3** | `usuariosAutorizados.json` con emails reales en el repo. Quitar |
| **P2-4** | Umbrales del filtro de calidad (Laplaciano 50, tinción HSV) son arbitrarios; versionarlos y loguear scores |
| **P2-5** | Dashboard sin i18n (el resto del front sí). Felino usa categoría `cachorro` |
| **P2-6** | `AUTH_GITHUB` vs `GITHUB_CLIENT_ID` inconsistentes entre `.env.example` y `auth.ts` |
| **P2-7** | No hay tests automatizados del motor clínico ni del filtro de calidad |
| **P2-8** | Secret Manager + IAM (nada de `.env.production` en la VM restaurado desde backup, como documenta el README del front) |
| **P2-9** | Sacar IPs, `GCP_PROJECT` y `SSH_USER` de `deploy.local.env.example`. Email hardcodeado en `wsi/page.tsx`. Node 18 en el workflow de CI |
| **P2-10** | Si algún día hay WSI vet: índices FK (`usuarioId`, `pacienteId`, `informeId`), paginación, ownership en cada GET, no unique global de dni/chip |

---

## Lo que sí conviene conservar

| Pieza | Por qué |
|-------|---------|
| Motor clínico `analisis.ts` + `valores_referencia` / `alteraciones` | Valor real del MVP híbrido. Hay que moverlo a servidor para no fiarse del cliente y poder auditar |
| Filtro de calidad antes de Cellpose | Patrón correcto: rechazar borrosas/mal teñidas antes de gastar GPU |
| `SmearCanvas` + bounding boxes | UX de citología usable. Falta persistir las cajas junto al estudio |
| Helpers GCS ya escritos | No reinventar upload; reusar `service.py` cuando se recorte el API |
| slowapi + ProxyHeaders (bien configurados) | La librería está; faltan `trusted_hosts` del LB y `@limiter.limit` en `analyze-smear` |
| Upload chunked directo al backend (`wsiUploadService`) | Evita que Next sea cuello de botella. Para frotis: signed URL a GCS es el mismo patrón, más simple |

---

## Arquitectura GCP recomendada (mínima para escalar)

Separar el request del usuario del cómputo de IA. Todo **stateless** salvo Cloud SQL y GCS.

| Componente | Servicio GCP | Rol |
|------------|--------------|-----|
| Frontend | Cloud Run (Next standalone) | UI + auth. Sin Prisma Accelerate ni PM2. `output: 'standalone'` |
| API | Cloud Run (CPU) | CRUD, auth, quality filter liviano, firmar URL de GCS, encolar jobs |
| Inferencia | Cloud Run GPU / GCE GPU / Vertex AI | Cellpose + morfometría. Un job por imagen, timeout largo, 0 HTTP público |
| Cola | Cloud Tasks o Pub/Sub | Desacopla upload de inferencia. Reintentos y DLQ |
| Archivos | Cloud Storage | Original, máscaras, overlay. Nunca disco del contenedor |
| Datos | Cloud SQL Postgres (1 instancia) | Un schema vet. NextAuth tables + estudios. Conexiones vía Auth Proxy / Unix socket |
| Secretos | Secret Manager | `AUTH_SECRET`, DB URL, HMAC admin. Nada en `.env` en disco |
| Borde | HTTPS LB + Cloud Armor | CORS, WAF, rate limit por IP, IAP para `/admin` y `/api/debug` si se dejan |

### No usar Cloud Run como VM

El deploy actual (systemd uvicorn + PM2 en Compute Engine, 1 worker, disco local, `.env` restaurado de backup) escala **vertical**, no horizontal.

Se puede levantar un MVP en una VM para demo, pero Cellpose + usuarios concurrentes van a pelearse la CPU. Si GCP es el destino, conviene **contenerizar ahora**, no después.

---

## Orden de trabajo

1. **Recortar producto:** dejar landing + dashboard + `analyze-smear`. No volver a montar `add_*_routes` de DigpathoWeb. Sacar debug, test-upload, analyze-region, WSI/HER2/bots.
2. **Una sola auth:** montar users en el API vet **o** autenticar el dashboard con NextAuth contra Cloud SQL. Proteger `/dashboard`. Firmar cookie admin. CORS desde env.
3. **Dockerfiles:** front standalone, back `python-slim` + `opencv-python-headless`. Añadir cellpose al requirements (o imagen base con el peso del modelo). Health que falle si el modelo no carga.
4. **`analyze-smear`:** tope de tamaño, auth, rate limit, `asyncio.to_thread`. Después: upload GCS + `job_id` (no bloquear HTTP con Cellpose).
5. **Schema vet único** en Cloud SQL (`tutor`, `mascota`, `estudio`, `hallazgos`). Persistir imagen + cajas + alertas. **No mostrar conteos simulados.**
6. **GCP:** Cloud Build → Artifact Registry → Cloud Run. Secret Manager. Quitar workflows SSH a DigpathoWeb. Logs JSON + request id.

Prioridad: **Recortar → Auth + CORS → Contenerizar → IA asíncrona → Cloud SQL + GCS**

---

## Criterio para el primer deploy GCP

Un veterinario autenticado sube un frotis, el API rechaza imágenes malas, Cellpose corre **fuera del request** (o al menos en un thread con tope de concurrencia 1 por instancia), el resultado se guarda, y el front **no habla** con `api.digpatho.com` ni con `localhost`.

Hasta que eso no esté, no hay nada que “escalar”: hay un MVP clínico mezclado con otro producto.

---

## Archivos críticos para el dev

| Path | Por qué |
|------|---------|
| `backend/app/main.py` | Único entrypoint vivo; CORS, Cellpose síncrono, conteos inventados |
| `backend/app/services/cellpose_service.py` | Modelo global, stub si no hay cellpose |
| `backend/app/services/quality_filter.py` | Conservar; umbrales P2 |
| `backend/requirements.txt` | Falta cellpose; `opencv-python` no headless |
| `backend/gunicorn_conf.py` | `workers = 1` por estado en RAM |
| `frontend/src/app/(private)/dashboard/page.tsx` | Dashboard público; fallback localhost |
| `frontend/src/lib/auth.ts` | NextAuth → `/users_login/` |
| `frontend/src/middleware.ts` | No cubre `/dashboard` |
| `frontend/src/utils/constants.ts` | Default `api.digpatho.com`; `API_TOKEN` público |
| `frontend/src/pages/api/debug/*` | Superficie de debug |
| `frontend/src/app/api/wsi/analyze-region/route.ts` | Proxy abierto al API humano |
| `frontend/next.config.ts` | Rewrite a localhost; 50gb; ignoreBuildErrors |
| `frontend/.github/workflows/deploy-frontend.yml` | Deploy SSH a DigpathoWeb |
| `frontend/deploy.local.env.example` | IPs / proyecto GCP de otro producto |
| `frontend/src/lib/analisis.ts` | Conservar; mover a servidor |
