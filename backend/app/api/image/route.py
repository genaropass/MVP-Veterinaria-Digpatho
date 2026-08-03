import asyncio
import uuid
from typing import Dict
from datetime import timedelta
from fastapi import Query, FastAPI, File, Form, HTTPException, Request, UploadFile, Depends
from app.api.database import db
from app.api.image import crud
from app.core.limiter import limiter
import os
from dotenv import load_dotenv
from google.cloud import storage
from app.api.informe import crud as crud_informe
from app.api.image import service
from app.api.image import ki67_tools
from app.api.user.token.decodificar_token import obtener_usuario_actual
from app.api.audit.auditoria import registrar_auditoria, OperacionAuditoria
from collections import Counter
import logging
from io import BytesIO
import shutil
import time
from pathlib import Path


# Cargar variables desde .env o .env_preprod
# Primero intentar .env_preprod (usado en preproducción), luego .env
from pathlib import Path
env_preprod_path = Path.home() / ".env_preprod"
if env_preprod_path.exists():
    load_dotenv(env_preprod_path)
else:
    load_dotenv()  # Busca .env en el directorio actual

logger = logging.getLogger(__name__)

HOST = os.getenv("HOST")
if not HOST:
    logger.warning("Variable HOST no está configurada en el entorno")
    CONDASERVER_URL = None
else:
    # Normalizar HOST para asegurar que tenga protocolo
    if not HOST.startswith(("http://", "https://")):
        logger.warning("HOST no tiene protocolo, agregando http://: %s", HOST)
        HOST = f"http://{HOST}"
    # Normalizar HOST: quitar barras finales y asegurar que termine con /
    HOST = HOST.rstrip("/")
    # Construir CONDASERVER_URL usando el nuevo endpoint /upload_imagen/ que acepta multipart/form-data
    CONDASERVER_URL = f"{HOST}/upload_imagen/"
    logger.info("CONDASERVER_URL configurado: %s (endpoint multipart/form-data)", CONDASERVER_URL)

HER2_HOST = os.getenv("HER2_HOST", "http://35.226.125.99:9000/")
# Normalizar HER2_HOST para asegurar que tenga protocolo
if HER2_HOST and not HER2_HOST.startswith(("http://", "https://")):
    logger.warning("HER2_HOST no tiene protocolo, agregando http://: %s", HER2_HOST)
    HER2_HOST = f"http://{HER2_HOST}"
# Asegurar que termine con /
HER2_HOST = HER2_HOST.rstrip("/") + "/"
HER2_UPLOAD_URL = f"{HER2_HOST}upload_imagen/"
logger.info("HER2_UPLOAD_URL configurado: %s", HER2_UPLOAD_URL)

# GCS: bucket ki67-images (env GCS_BUCKET_NAME); credenciales vía GOOGLE_APPLICATION_CREDENTIALS
_gcs_bucket_name = os.getenv("GCS_BUCKET_NAME", "ki67-images")
try:
    _storage_client = storage.Client()
    gcs_bucket = _storage_client.bucket(_gcs_bucket_name)
except Exception:
    _storage_client = None
    gcs_bucket = None
    logger.warning("Google Cloud Storage no disponible en local")

# ============================================================
# 🧠 MEMORIA TEMPORAL (CACHE DE ESTADOS)
# ============================================================
# Guardamos el resultado y el estado de cada tarea en memoria RAM
resultados_procesamiento: Dict[str, dict] = {}   # task_id -> resultado IA
estado_tareas: Dict[str, str] = {}               # task_id -> "pending" | "processing" | "done" | "error"

# Estado de uploads chunked WSI                                                                             
uploads_pendientes: Dict[str, dict] = {}         # upload_id -> {informe_id, filename, size, content_type, user_id, total_chunks, received_chunks: set(), created_at}  

# Directorio temporal para los chunks
CHUNKED_UPLOAD_DIR = "/tmp/wsi_uploads"

from unicodedata import normalize as _unicodedata_normalize

# Cola de procesamiento
procesamiento_queue = asyncio.Queue()
procesamiento_queue_her2 = asyncio.Queue()


# ============================================================
# 🔍 Helpers HER2
# ============================================================
# Mapeo orden interno del modelo (índices 0-3) → etiqueta clínica (Spec HER2 V2 punto 3).
# Ajustar según tabla exacta que entregue el equipo de modelo.
MAPEO_INDICE_A_LABEL_HER2 = {
    0: "No tinción",
    1: "Baja incompleta",   # o "1+"
    2: "Moderada completa",  # o "2+"
    3: "Alta completa",    # o "3+"
}


def _label_her2_desde_indice(val) -> str:
    """Si el modelo devuelve índice (0-3), convierte a etiqueta clínica."""
    if val is None:
        return ""
    idx = int(val) if isinstance(val, (int, float)) else (int(val) if str(val).isdigit() else None)
    if idx is not None and idx in MAPEO_INDICE_A_LABEL_HER2:
        return MAPEO_INDICE_A_LABEL_HER2[idx]
    return str(val)


def _normalizar_texto_her2(texto: str) -> str:
    """
    Normaliza texto proveniente del modelo HER2:
    - pasa a minúsculas
    - remueve acentos
    - unifica separadores (guiones bajos → espacios)
    - elimina espacios extra
    """
    if not texto:
        return ""
    txt = _unicodedata_normalize("NFKD", str(texto))
    txt = "".join(ch for ch in txt if not ord(ch) > 127)  # quitar acentos
    txt = txt.replace("_", " ")
    return " ".join(txt.lower().split())


def _parsear_label_her2(label: str) -> dict:
    """
    A partir de un label libre del modelo, intenta extraer:
    - categoria de intensidad: no_tincion | baja | moderada | alta | na
    - completitud perinuclear: completa | incompleta | None

    Soporta distintos formatos como:
    - 'Alta completa'
    - 'baja_incompleta'
    - 'NA', 'no tumoral', 'estroma', etc.
    """
    txt = _normalizar_texto_her2(label)

    # Sin tinción (0+) antes que NA: son células tumorales válidas para el denominador
    if "no tincion" in txt or "sin tincion" in txt or "0+" in txt:
        categoria = "no_tincion"
    # NA / estroma / no tumorales (excluidas del score)
    elif any(pal in txt for pal in [" na", " estroma", "stroma", "no tumoral", "no tumoral/estroma"]) or txt in ("na", "n/a"):
        categoria = "na"
    elif "baja" in txt or "1+" in txt:
        categoria = "baja"
    elif "moderad" in txt or "2+" in txt:
        categoria = "moderada"
    elif "alta" in txt or "intensa" in txt or "3+" in txt:
        categoria = "alta"
    else:
        # si no reconocemos nada, consideramos NA para no contaminar el score
        categoria = "na"

    completitud = None
    if "incomplet" in txt:
        completitud = "incompleta"
    elif "complet" in txt:
        completitud = "completa"

    return {"categoria": categoria, "completitud": completitud}


def _normalizar_resultado_ia(raw: dict) -> tuple[list, dict, str | None]:
    """
    Normaliza la respuesta del servicio de IA (Ki67 u otro) al mismo formato que HER2,
    para que el frontend reciba siempre result.resultado.coordinates y result.estadisticas.
    Acepta: coordinates/coordenadas (lista de {x,y,label,min_axis}) o x_coords/y_coords/labels.
    Returns: (coordinates, estadisticas, processed_image).
    """
    resultado = raw.get("resultado", raw) if isinstance(raw, dict) else {}
    if not isinstance(resultado, dict):
        resultado = {}

    coordinates = []
    raw_coords = None
    if isinstance(resultado.get("coordinates"), list):
        raw_coords = resultado["coordinates"]
    elif isinstance(resultado.get("coordenadas"), list):
        raw_coords = resultado["coordenadas"]

    if raw_coords is not None:
        for c in raw_coords:
            coordinates.append({
                "x": int(c.get("x", 0)),
                "y": int(c.get("y", 0)),
                "label": str(c.get("label", "")),
                "min_axis": float(c.get("min_axis", 10)),
            })
    elif all(k in resultado for k in ("x_coords", "y_coords", "labels")):
        x_coords = resultado["x_coords"]
        y_coords = resultado["y_coords"]
        labels = resultado["labels"]
        min_axis_list = resultado.get("min_axis", [10] * len(labels))
        for x, y, label, ma in zip(x_coords, y_coords, labels, min_axis_list):
            coordinates.append({
                "x": int(x),
                "y": int(y),
                "label": str(label),
                "min_axis": float(ma),
            })

    if coordinates:
        labels = [c["label"] for c in coordinates]
    else:
        labels = []
        if isinstance(resultado.get("labels"), list):
            labels = [str(l) for l in resultado["labels"]]

    total = len(labels)
    conteo = dict(Counter(labels))
    porcentajes = {
        k: round((v / total) * 100, 2) if total > 0 else 0
        for k, v in conteo.items()
    }
    estadisticas = {
        "total_celulas": total,
        "conteo_por_clasificacion": conteo,
        "porcentajes": porcentajes,
    }

    processed_image = (
        resultado.get("processed_image")
        or resultado.get("imagen_procesada")
        or resultado.get("image")
    )

    return (coordinates, estadisticas, processed_image)


def calcular_score_her2(coordinates: list[dict]) -> dict:
    """
    Implementa la lógica ASCO/CAP para HER2 a partir de las coordenadas de células.

    - Ignora células NA (estroma/no tumoral) para el cálculo de porcentajes.
    - Incluye no_tincion (0+) en el denominador; no suman a categorías positivas.
    - Calcula distribución:
        * baja_incompleta
        * moderada_completa
        * alta_completa
        * alta_total (todas las 'alta', completas o no)
    - Aplica reglas:
        1) Si Alta Completa > 10% → Score 3+.
        2) Si Moderada Completa > 10% O (Alta Total > 0 y ≤ 10%) → Score 2+.
        3) Si Baja Incompleta > 10% → Score 1+.
        4) De lo contrario → Score 0.
    """
    total_validas = 0
    conteos = {
        "no_tincion": 0,
        "baja_incompleta": 0,
        "moderada_completa": 0,
        "alta_completa": 0,
        "alta_total": 0,
    }

    for c in coordinates or []:
        label = c.get("label", "") or c.get("categoria", "")
        parsed = _parsear_label_her2(label)

        categoria = parsed["categoria"]
        completitud = parsed["completitud"]

        # Guardamos también la interpretación para uso del front
        c["her2_categoria"] = categoria
        c["her2_completitud"] = completitud

        # Excluir NA del conteo estadístico
        if categoria == "na":
            continue

        total_validas += 1

        if categoria == "no_tincion":
            conteos["no_tincion"] += 1
        elif categoria == "alta":
            conteos["alta_total"] += 1
            if completitud == "completa":
                conteos["alta_completa"] += 1

        if categoria == "moderada" and completitud == "completa":
            conteos["moderada_completa"] += 1

        # La guía habla de "Baja/Incompleta".
        # Si explícitamente indica incompleta, lo contamos; en caso contrario, lo dejamos fuera.
        if categoria == "baja" and completitud == "incompleta":
            conteos["baja_incompleta"] += 1

    def pct(n: int) -> float:
        return round((n / total_validas) * 100, 2) if total_validas > 0 else 0.0

    porcentajes = {k: pct(v) for k, v in conteos.items()}

    # Reglas de score
    score = "0"
    if porcentajes["alta_completa"] > 10:
        score = "3+"
    elif porcentajes["moderada_completa"] > 10 or (porcentajes["alta_total"] > 0 and porcentajes["alta_total"] <= 10):
        score = "2+"
    elif porcentajes["baja_incompleta"] > 10:
        score = "1+"

    distribucion = {
        "no_tincion": {
            "cantidad": conteos["no_tincion"],
            "porcentaje": porcentajes["no_tincion"],
        },
        "baja_incompleta": {
            "cantidad": conteos["baja_incompleta"],
            "porcentaje": porcentajes["baja_incompleta"],
        },
        "moderada_completa": {
            "cantidad": conteos["moderada_completa"],
            "porcentaje": porcentajes["moderada_completa"],
        },
        "alta_completa": {
            "cantidad": conteos["alta_completa"],
            "porcentaje": porcentajes["alta_completa"],
        },
    }

    return {
        "total_celulas_validas": total_validas,
        "conteos": conteos,
        "porcentajes": porcentajes,
        "distribucion": distribucion,
        "score_final": score,
    }


# ============================================================
# 👷 WORKER HER2 (procesamiento secuencial con coordenadas e imagen)
# ============================================================
async def worker_her2():
    logger.info("Worker HER2 iniciado...")

    while True:
        tarea = await procesamiento_queue_her2.get()

        task_id = tarea["task_id"]
        file_location = tarea["file_location"]
        filename = tarea["filename"]
        informe_id = tarea["informe_id"]
        usuario_id = tarea.get("usuario_id")
        ip = tarea.get("ip")

        try:
            estado_tareas[task_id] = "processing"
            logger.info("Procesando HER2: %s", filename)

            # 1️⃣ Descargar imagen desde GCS a /tmp
            local_path = f"/tmp/{filename}"
            service.download_gcs_to_path(gcs_bucket, file_location, local_path)

            # 2️⃣ Enviar imagen al modelo HER2
            with open(local_path, "rb") as f:
                model_response = service.forward_file_to_her2_model(f, HER2_UPLOAD_URL)

            # El modelo puede devolver directamente el resultado o dentro de "resultado"
            resultado = model_response.get("resultado", model_response)

            # 3️⃣ Extraer COORDENADAS REALES (no inventadas)
            coordinates = []

            if isinstance(resultado, dict):
                # Caso A: ya viene una lista de objetos "coordinates" o "coordenadas"
                raw_coords = None
                if isinstance(resultado.get("coordinates"), list):
                    raw_coords = resultado["coordinates"]
                elif isinstance(resultado.get("coordenadas"), list):
                    raw_coords = resultado["coordenadas"]

                if raw_coords is not None:
                    for c in raw_coords:
                        raw_label = c.get("label", "")
                        coordinates.append({
                            "x": int(c.get("x", 0)),
                            "y": int(c.get("y", 0)),
                            "label": _label_her2_desde_indice(raw_label) or str(raw_label),
                            "min_axis": float(c.get("min_axis", 10)),
                        })

                # Caso B: arrays separados x_coords / y_coords / labels / min_axis
                elif all(k in resultado for k in ("x_coords", "y_coords", "labels")):
                    x_coords = resultado["x_coords"]
                    y_coords = resultado["y_coords"]
                    labels = resultado["labels"]
                    min_axis_list = resultado.get("min_axis", [10] * len(labels))

                    for x, y, label, ma in zip(x_coords, y_coords, labels, min_axis_list):
                        coordinates.append({
                            "x": int(x),
                            "y": int(y),
                            "label": _label_her2_desde_indice(label) or str(label),
                            "min_axis": float(ma),
                        })

            # 4️⃣ Estadísticas a partir de lo que tengamos
            if coordinates:
                labels = [c["label"] for c in coordinates]
            else:
                # fallback: si no hay coords, usar labels "sueltos" si existen
                labels = []
                if isinstance(resultado, dict) and isinstance(resultado.get("labels"), list):
                    labels = [str(l) for l in resultado["labels"]]

            total = len(labels)
            conteo = dict(Counter(labels))
            porcentajes = {
                k: round((v / total) * 100, 2) if total > 0 else 0
                for k, v in conteo.items()
            }

            # Estadísticas clásicas por label bruto (para compatibilidad)
            estadisticas_base = {
                "total_celulas": total,
                "conteo_por_clasificacion": conteo,
                "porcentajes": porcentajes,
            }

            # 4b️⃣ Estadísticas específicas HER2 (ignorando NA y aplicando ASCO/CAP)
            her2_stats = calcular_score_her2(coordinates)

            estadisticas = {
                **estadisticas_base,
                "her2": her2_stats,
            }

            # 5️⃣ Imagen procesada en base64 (si el modelo la devuelve)
            processed_image = None
            if isinstance(resultado, dict):
                processed_image = (
                    resultado.get("processed_image")
                    or resultado.get("imagen_procesada")
                    or resultado.get("image")
                )

            # Si no vino, usamos la original como fallback
            if not processed_image and os.path.exists(local_path):
                import base64
                with open(local_path, "rb") as img_file:
                    processed_image = (
                        "data:image/jpeg;base64,"
                        + base64.b64encode(img_file.read()).decode("utf-8")
                    )

            # 6️⃣ Guardar JSON en GCS
            json_key = f"procesados-her2/{filename}.json"
            service.subir_json_gcs(
                json_key,
                {
                    "modelo": "her2",
                    "resultado": {
                        "coordinates": coordinates,      # 👈 coords reales o []
                        "processed_image": processed_image,
                    },
                    "estadisticas": estadisticas,
                },
                gcs_bucket,
            )

            # 7️⃣ Guardar registro en la base de datos
            await crud.create_imagen(db, file_location, informe_id, usuario_id=usuario_id, ip=ip)

            # 8️⃣ Guardar resultado en memoria para /result/{task_id}
            resultados_procesamiento[task_id] = {
                "status": "done",
                "result": {
                    "resultado": {
                        "coordinates": coordinates,
                        "processed_image": processed_image,
                    },
                    "estadisticas": estadisticas,
                },
                "file_location": file_location,
                "filename": filename,
            }
            estado_tareas[task_id] = "done"
            logger.info("HER2 terminado correctamente: %s", filename)

        except Exception as e:
            logger.exception("Error en HER2: %s", e)
            estado_tareas[task_id] = "error"
            resultados_procesamiento[task_id] = {
                "status": "error",
                "error": str(e),
            }

        finally:
            procesamiento_queue_her2.task_done()



async def worker_procesador_imagenes():
    logger.info("Worker iniciado (modo secuencial con Task ID)")
    while True:
        # 1. Esperar tarea
        tarea = await procesamiento_queue.get()

        task_id = tarea["task_id"]
        file_location = tarea["file_location"]
        filename_con_nombre = tarea["filename_con_nombre"]
        informe_id = tarea["informe_id"]
        usuario_id = tarea.get("usuario_id")
        ip = tarea.get("ip")

        try:
            # Marcar como procesando
            estado_tareas[task_id] = "processing"
            logger.info("Procesando: %s - %s", task_id, filename_con_nombre)

            # Validar que la URL esté configurada
            if not CONDASERVER_URL:
                raise Exception("CONDASERVER_URL no está configurado. Verifica la variable HOST en el entorno.")

            # 1.5 Activar modelo Ki67 en CONDASERVER si no está cargado (evita respuestas vacías)
            await ki67_tools.if_model()

            # 1.6 Descargar imagen desde GCS y enviarla directamente al servicio Ki67
            # Como no podemos generar URLs firmadas (política de organización bloquea claves de cuenta de servicio),
            # el backend descarga la imagen y la envía directamente como multipart/form-data
            logger.info("Descargando imagen desde GCS: %s", file_location)
            blob = gcs_bucket.blob(file_location)
            imagen_bytes = blob.download_as_bytes()
            logger.info("Imagen descargada: %d bytes", len(imagen_bytes))

            # 2. ANALIZAR IA - Enviar archivo directamente como multipart/form-data
            # El servicio Ki67 ahora tiene el endpoint /upload_imagen/ que acepta multipart/form-data
            logger.info("Enviando imagen directamente al servicio Ki67 (multipart): %s", CONDASERVER_URL)
            json_data = await service.analizar_imagen_ia_con_archivo(
                imagen_bytes, filename_con_nombre, CONDASERVER_URL
            )

            # 3. NORMALIZAR respuesta Ki67 al mismo formato que HER2 (resultado.coordinates + estadisticas)
            raw_payload = json_data if isinstance(json_data, dict) and json_data else {}
            coordinates, estadisticas, processed_image = _normalizar_resultado_ia(raw_payload)

            payload_para_s3 = {
                "modelo": "ki67",
                "resultado": {
                    "coordinates": coordinates,
                    "processed_image": processed_image,
                },
                "estadisticas": estadisticas,
            }

            # 4. GUARDAR JSON EN GCS
            json_key = f"procesados/{filename_con_nombre}.json"
            service.subir_json_gcs(json_key, payload_para_s3, gcs_bucket)

            # 5. GUARDAR EN BD
            await crud.create_imagen(db, file_location, informe_id, usuario_id=usuario_id, ip=ip)
            
            # 6. GUARDAR RESULTADO EN MEMORIA (misma estructura que HER2 para que el front funcione igual)
            resultados_procesamiento[task_id] = {
                "status": "done",
                "result": {
                    "resultado": {
                        "coordinates": coordinates,
                        "processed_image": processed_image,
                    },
                    "estadisticas": estadisticas,
                },
                "file_location": file_location,
                "filename": filename_con_nombre
            }
            if not coordinates and not raw_payload:
                resultados_procesamiento[task_id]["warning"] = "El servicio de IA no devolvió datos de análisis."
            estado_tareas[task_id] = "done"

            logger.info("Finalizado %s", task_id)

        except HTTPException as http_exc:
            error_msg = http_exc.detail if http_exc.detail else f"Error HTTP {http_exc.status_code}"
            logger.error("HTTPException procesando %s: %s", task_id, error_msg)
            estado_tareas[task_id] = "error"
            resultados_procesamiento[task_id] = {
                "status": "error",
                "error": error_msg
            }
        except Exception as e:
            import traceback
            error_traceback = traceback.format_exc()
            error_msg = str(e) if e and str(e) else "Error desconocido al procesar imagen"
            logger.error(
                "ERROR procesando %s — type=%s error=%s\n%s",
                task_id, type(e).__name__, error_msg, error_traceback,
            )
            estado_tareas[task_id] = "error"
            resultados_procesamiento[task_id] = {
                "status": "error",
                "error": error_msg
            }
        finally:
            procesamiento_queue.task_done()


async def limpiar_uploads_viejos():
    """
    Tarea de limpieza programada para eliminar chunks de uploads abandonados.
    Se ejecuta periódicamente mediante APScheduler.
    Borra carpetas en /tmp/wsi_uploads/ que tengan más de 1 hora de antigüedad
    y limpia el diccionario uploads_pendientes en memoria.
    """
    logger.info("Iniciando limpieza de uploads viejos (WSI)...")

    # 1. Limpiar directorio /tmp/wsi_uploads
    base_dir = Path(CHUNKED_UPLOAD_DIR)
    now = time.time()
    max_age_seconds = 1 * 60 * 60  # 1 hora

    if base_dir.exists():
        for folder in base_dir.iterdir():
            if folder.is_dir():
                try:
                    # st_mtime es la fecha de ultima modificacion
                    folder_age = now - folder.stat().st_mtime
                    if folder_age > max_age_seconds:
                        upload_id = folder.name
                        logger.info("Eliminando carpeta antigua de upload WSI: %s (%.1f hs)", upload_id, folder_age / 3600)
                        shutil.rmtree(folder, ignore_errors=True)
                        
                        # Limpiar del diccionario en memoria si aún existe
                        uploads_pendientes.pop(upload_id, None)
                except Exception as e:
                    logger.error("Error al eliminar carpeta %s: %s", folder, e)

    # 2. Limpiar diccionario en memoria (por si quedó alguno sin carpeta creada)
    uploads_a_borrar = []
    for upload_id, data in uploads_pendientes.items():
        # created_at se guardó como time.time() en el init
        age = now - data.get("created_at", now)
        if age > max_age_seconds:
            uploads_a_borrar.append(upload_id)
            
    for upload_id in uploads_a_borrar:
        logger.info("Eliminando registro en memoria antiguo de upload WSI: %s", upload_id)
        uploads_pendientes.pop(upload_id, None)
        
    logger.info("Limpieza de uploads viejos finalizada.")


def add_imagen_routes(app: FastAPI):
    
    # ARRANCAR EL WORKER AL INICIO
    @app.on_event("startup")
    async def startup_event():
        asyncio.create_task(worker_procesador_imagenes())
        asyncio.create_task(worker_her2())                  # Worker HER2

    # ============================================================
    # 🔎 ENDPOINT DE CONSULTA (POLLING) - NUEVO
    # ============================================================
    @app.get("/result/{task_id}", tags=["Imágenes"])
    async def get_result(task_id: str):
        """
        El frontend llama a esto cada 2 segundos para ver si terminó.
        """
        # Si no existe el ID, 404
        if task_id not in estado_tareas:
            raise HTTPException(404, "Task ID no encontrado")

        estado = estado_tareas[task_id]

        # Si sigue pensando, devolvemos solo el estado
        if estado == "pending" or estado == "processing":
            return {"status": estado}

        # Si terminó, devolvemos todo el resultado
        return resultados_procesamiento[task_id]

    # ============================================================
    # 📤 SUBIR IMAGEN (ENCOLAR Y DEVOLVER ID)
    # ============================================================
    @app.post("/upload/", tags=["Imágenes"])
    @limiter.limit("60/minute")
    async def upload_imagen(
        request: Request,
        informe_id: str = Form(...),
        file: UploadFile = File(),
        usuario: dict = Depends(obtener_usuario_actual)
    ):
        logger.info(
            "REQUEST /upload/ — filename=%s content_type=%s informe_id=%s",
            file.filename, file.content_type, informe_id,
        )

        file_content = await file.read()
        logger.debug("Tamaño del archivo: %d bytes", len(file_content))

        try:
            user_id = usuario["sub"]
            logger.debug("User ID: %s", user_id)

            service.valid_uuid(informe_id)
            logger.debug("UUID válido")

            await crud_informe.get_informe_id(db, informe_id)
            logger.debug("Informe encontrado en BD")

            if len(file_content) == 0:
                raise HTTPException(400, "Archivo vacío")
            if not file.content_type.startswith("image/"):
                raise HTTPException(400, "Tipo inválido")
            logger.debug("Validaciones de archivo pasadas")

            # Generar nombre
            logger.debug("Generando nombre de archivo...")
            filename_con_nombre = await service.generar_nombre_archivo(
                db, crud, informe_id, file.filename
            )
            file_location = f"imagenes-dg-prueba/{filename_con_nombre}"
            logger.debug("Nombre generado: %s", filename_con_nombre)

            # Subir a GCS
            logger.info("Subiendo a GCS: %s", file_location)
            service.subir_bytes_gcs(
                gcs_bucket,
                file_location,
                file_content,
                file.content_type or "application/octet-stream",
                user_id,
            )
            logger.info("Archivo subido a GCS exitosamente")

            # Crear Task ID único
            task_id = str(uuid.uuid4())
            estado_tareas[task_id] = "pending"
            logger.info("Task ID creado: %s", task_id)

            # Validar URL antes de encolar
            # NOTA: /upload/ es para Ki67 y requiere HOST configurado
            # Si solo usas HER2, usa /upload-her2/ en su lugar
            if not CONDASERVER_URL:
                error_msg = "CONDASERVER_URL no está configurado. El endpoint /upload/ requiere la variable HOST para Ki67. Si solo usas HER2, usa el endpoint /upload-her2/ en su lugar."
                logger.error(error_msg)
                raise HTTPException(500, error_msg)
            logger.debug("CONDASERVER_URL configurado: %s", CONDASERVER_URL)

            # Encolar la tarea
            logger.info("Encolando tarea en queue (tamaño actual: %d)", procesamiento_queue.qsize())
            await procesamiento_queue.put({
                "task_id": task_id,
                "file_location": file_location,
                "filename_con_nombre": filename_con_nombre,
                "informe_id": informe_id,
                "usuario_id": user_id,
                "ip": request.client.host if request.client else None,
            })
            logger.info("Tarea encolada exitosamente. Queue size: %d", procesamiento_queue.qsize())

            # Responder rápido con el ID para que el front haga polling
            response = {
                "message": "Imagen encolada.",
                "task_id": task_id,
                "status": "pending",
                "queue_position": procesamiento_queue.qsize(),
                "filename": filename_con_nombre
            }
            logger.info("Respondiendo al cliente con task_id=%s", task_id)
            return response

        except HTTPException as http_exc:
            logger.warning("HTTPException en /upload/: %d - %s", http_exc.status_code, http_exc.detail)
            raise http_exc
        except Exception as e:
            import traceback
            error_traceback = traceback.format_exc()
            error_msg = str(e) if e and str(e) else "Error desconocido"
            logger.error("ERROR en /upload/ — type=%s error=%s\n%s", type(e).__name__, error_msg, error_traceback)
            raise HTTPException(500, f"Error al encolar imagen: {error_msg}")

    # ============================================================
    # RESTO DE ENDPOINTS (JSON, DELETE, GET, HER2)
    # ============================================================
    
    @app.post("/correcion_json/", tags=["Imágenes"])
    async def correcion_json(imagen_id: str, jsonCorregido: str):
        try:
            service.valid_uuid(imagen_id)
            ubicacion = await crud.get_ubicacion_imagen(db, imagen_id)
            new_name = ubicacion.split('/')[-1].split('.')[0]
            service.subir_json_gcs(f"jsoncorregidos/{new_name}.json", jsonCorregido, gcs_bucket)
            return {"message": "json guardado correctamente"}
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error al modificar json.")

    @app.get("/imagenes/descargar/{imagen_id}", tags=["Imágenes"])
    async def descargar_imagen(imagen_id: str, request: Request, usuario: dict = Depends(obtener_usuario_actual)):
        service.valid_uuid(imagen_id)
        imagen = await crud.get_imagen(db, imagen_id, usuario_id=usuario["sub"], ip=request.client.host if request.client else None)
        try:
            return await service.download_image_gcs(gcs_bucket, imagen.ubicacion)
        except HTTPException as http_exc:
            raise http_exc
        except Exception as e:
            return {"error": str(e)}

    @app.get("/imagenes/{imagen_id}", tags=["Imágenes"])
    async def get_imagen(imagen_id: str, request: Request, usuario: dict = Depends(obtener_usuario_actual)):
        service.valid_uuid(imagen_id)
        try:
            imagen = await crud.get_imagen(db, imagen_id, usuario_id=usuario["sub"], ip=request.client.host if request.client else None)
            if not imagen:
                raise HTTPException(status_code=404, detail="Ubicación inválida.")
            return await service.get_url_gcs(gcs_bucket, imagen.ubicacion)
        except HTTPException as http_exc:
            raise http_exc
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al obtener la imagen: {str(e)}")

    @app.get("/imagenes/informe_id/{informe_id}", tags=["Imágenes"])
    async def list_imagenes(informe_id: str, request: Request, usuario: dict = Depends(obtener_usuario_actual)):
        try:
            service.valid_uuid(informe_id)
            await crud_informe.get_informe_id(db, informe_id)
            imagenes = await crud.get_imagenes_by_informe(db, informe_id)
            if not imagenes:
                raise HTTPException(status_code=404, detail="No se encontraron imágenes para este informe")
            await registrar_auditoria(
                tabla="imagen",
                operacion=OperacionAuditoria.LEER,
                registro_id=informe_id,
                usuario_id=usuario["sub"],
                ip=request.client.host if request.client else None,
            )
            return imagenes
        except HTTPException as http_exc:
            raise http_exc
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al obtener las imágenes: {str(e)}")

    @app.delete("/imagenes/{imagen_id}", tags=["Imágenes"])
    async def delete_imagen(imagen_id: str, request: Request, usuario: dict = Depends(obtener_usuario_actual)):
        service.valid_uuid(imagen_id)
        try:
            imagen = await crud.get_imagen(db, imagen_id)
            deleted = await crud.delete_imagen(db, imagen_id, usuario_id=usuario["sub"], ip=request.client.host if request.client else None)
            if deleted:
                await service.delete_gcs(imagen.ubicacion, gcs_bucket)
            return {"message": "Imagen eliminada completamente"}
        except HTTPException as http_exc:
            raise http_exc
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al eliminar la imagen: {str(e)}")

    @app.post("/upload-her2/", tags=["Imágenes"])
    @limiter.limit("60/minute")
    async def upload_her2(
        request: Request,
        informe_id: str = Form(...),
        file: UploadFile = File(),
        usuario: dict = Depends(obtener_usuario_actual)
    ):
        try:
            user_id = usuario["sub"]
            service.valid_uuid(informe_id)
            service.type_image(file)
            await crud_informe.get_informe_id(db, informe_id)

            filename = await service.generar_nombre_archivo(
                db, crud, informe_id, file.filename
            )
            file_location = f"imagenes-dg-prueba/{filename}"

            # Subir a GCS
            file.file.seek(0)
            service.subir_archivo_gcs(file, file_location, gcs_bucket, user_id)

            # Crear task_id
            task_id = str(uuid.uuid4())
            estado_tareas[task_id] = "pending"

            # Encolar tarea
            await procesamiento_queue_her2.put({
                "task_id": task_id,
                "file_location": file_location,
                "filename": filename,
                "informe_id": informe_id,
                "usuario_id": user_id,
                "ip": request.client.host if request.client else None,
            })

            return {
                "message": "Imagen encolada HER2",
                "task_id": task_id,
                "status": "pending",
                "filename": filename
            }

        except Exception as e:
            raise HTTPException(500, f"Error HER2: {str(e)}")
        @app.get("/her2-status/{filename}")
        async def her2_status(filename: str):
            json_key = f"procesados-her2/{filename}.json"

            try:
                contenido = service.get_json_gcs(json_key, gcs_bucket)
                return {
                    "status": "done",
                    "resultado": contenido
                }
            except HTTPException:
                raise
            except Exception:
                return {"status": "processing"}

    @app.post("/upload-wsi/", tags=["Imágenes - WSI"])
    @limiter.limit("60/minute")
    async def upload_wsi(
        request: Request,
        informe_id: str = Form(...),
        file: UploadFile = File(),
        usuario: dict = Depends(obtener_usuario_actual)
    ):
        """
        Endpoint para subir imágenes WSI (TIFF, SVS, NDPI, etc.).
        Almacena el archivo en GCS en la carpeta 'wsi/' y guarda referencia en BD con tipo_imagen='wsi'.
        Genera tiles dinámicamente mediante GET /tiles/{imagen_id}/{nivel}/{x}/{y}
        """
        logger.info(
            "REQUEST /upload-wsi/ — filename=%s content_type=%s informe_id=%s",
            file.filename, file.content_type, informe_id,
        )

        file_size = service.get_upload_size(file)
        logger.debug("Tamaño del archivo WSI: %d bytes", file_size)

        try:
            user_id = usuario["sub"]
            logger.debug("User ID: %s", user_id)

            service.valid_uuid(informe_id)
            logger.debug("UUID válido")

            await crud_informe.get_informe_id(db, informe_id)
            logger.debug("Informe encontrado en BD")

            # Validar que sea archivo WSI
            if not service.es_wsi(file.filename, file.content_type or ""):
                raise HTTPException(
                    status_code=400,
                    detail="El archivo no es WSI válido. Formatos soportados: .tiff, .tif, .svs, .ndpi, .mrxs, .vms, .vmu, .scn, .dzi"
                )
            logger.debug("Validado como archivo WSI")

            if file_size == 0:
                raise HTTPException(400, "Archivo vacío")
            logger.debug("Validaciones de archivo pasadas")

            # Generar nombre para el archivo
            logger.debug("Generando nombre de archivo...")
            filename_con_nombre = await service.generar_nombre_archivo(
                db, crud, informe_id, file.filename
            )

            # Guardar en carpeta "wsi/" de GCS
            wsi_location = f"wsi/{filename_con_nombre}"
            logger.info("Subiendo WSI a GCS: %s", wsi_location)

            # Evita cargar WSI completos (400MB-1GB) en RAM: stream directo a GCS.
            # 8 MiB por chunk: buen balance entre memoria y throughput.
            service.subir_archivo_gcs(
                file=file,
                key=wsi_location,
                bucket=gcs_bucket,
                user_id=user_id,
                chunk_size=8 * 1024 * 1024,
            )
            logger.info("WSI subido a GCS exitosamente")

            # Guardar en BD con tipo_imagen='wsi'
            logger.debug("Guardando en BD...")
            imagen_db = await crud.create_imagen_with_type(
                db,
                ubicacion=wsi_location,
                informe_id=informe_id,
                tipo_imagen="wsi",
                usuario_id=user_id,
                ip=request.client.host if request.client else None,
            )
            logger.info("Imagen guardada en BD: %s", imagen_db.id)

            response = {
                "message": "WSI subido exitosamente",
                "imagen_id": imagen_db.id,
                "ubicacion": wsi_location,
                "tipo": "wsi"
            }
            logger.info("Respondiendo al cliente con imagen_id=%s", imagen_db.id)
            return response

        except HTTPException as http_exc:
            logger.warning("HTTPException en /upload-wsi/: %d - %s", http_exc.status_code, http_exc.detail)
            raise http_exc
        except Exception as e:
            import traceback
            error_traceback = traceback.format_exc()
            error_msg = str(e) if e and str(e) else "Error desconocido"
            logger.error("ERROR en /upload-wsi/ — type=%s error=%s\n%s", type(e).__name__, error_msg, error_traceback)
            raise HTTPException(500, f"Error al subir WSI: {error_msg}")

    # Este endpoint se encarga de recibir la intención de subida, validar los datos (informe, tipo
    # de archivo, etc.) y crear tanto el ID de subida como el directorio temporal.
    @app.post("/upload-wsi/init", tags=["Imágenes - WSI"])                                      
    @limiter.limit("10/minute")
    async def upload_wsi_init(
        request: Request,
        informe_id: str = Form(...),
        filename: str = Form(...),
        size: int = Form(...),
        content_type: str = Form(...),
        total_chunks: int = Form(...),
        usuario: dict = Depends(obtener_usuario_actual)
    ):
        logger.info("INIT /upload-wsi/init — filename=%s informe_id=%s chunks=%d", filename, informe_id, total_chunks)
        
        user_id = usuario["sub"]
        
        # Cancelar y eliminar silenciosamente cualquier subida previa del mismo usuario
        subidas_previas = [uid for uid, info in uploads_pendientes.items() if info.get("user_id") == user_id]
        for prev_id in subidas_previas:
            logger.info("Cancelando subida previa e incompleta del usuario %s (upload_id=%s)", user_id, prev_id)
            prev_dir = Path(CHUNKED_UPLOAD_DIR) / prev_id
            if prev_dir.exists():
                shutil.rmtree(prev_dir, ignore_errors=True)
            uploads_pendientes.pop(prev_id, None)
        
        # 1. Validaciones
        service.valid_uuid(informe_id)
        await crud_informe.get_informe_id(db, informe_id)
        
        if not service.es_wsi(filename, content_type):
            raise HTTPException(
                status_code=400,
                detail="El archivo no es WSI válido. Formatos soportados: .tiff, .tif, .svs, .ndpi, .mrxs, .vms, .vmu, .scn, .dzi"
            )
            
        if size <= 0 or total_chunks <= 0:
            raise HTTPException(400, "Tamaño de archivo o chunks inválido")
        # 2. Generar ID y preparar directorio
        upload_id = str(uuid.uuid4())
        upload_path = Path(CHUNKED_UPLOAD_DIR) / upload_id
        upload_path.mkdir(parents=True, exist_ok=True)
        
        # 3. Guardar estado en memoria
        uploads_pendientes[upload_id] = {
            "informe_id": informe_id,
            "filename": filename,
            "size": size,
            "content_type": content_type,
            "user_id": user_id,
            "total_chunks": total_chunks,
            "received_chunks": set(),  # Usamos un set para llevar track de los índices recibidos
            "created_at": time.time()
        }
        
        return {
            "message": "Upload inicializado",
            "upload_id": upload_id
        }

    @app.put("/upload-wsi/chunk/{upload_id}", tags=["Imágenes - WSI"])                          
    @limiter.limit("200/minute")  # Límite alto porque llegan muchos chunks                     
    async def upload_wsi_chunk(                                                                 
        request: Request,                                                                       
        upload_id: str,                                                                         
        chunk_index: int = Query(...),                                                          
        usuario: dict = Depends(obtener_usuario_actual)
    ):
        user_id = usuario["sub"]
        
        # 1. Validar que la sesión de subida exista
        upload_info = uploads_pendientes.get(upload_id)
        if not upload_info:
            raise HTTPException(404, "Upload ID no encontrado o expirado")
            
        # 2. Validar propiedad
        if upload_info["user_id"] != user_id:
            raise HTTPException(403, "No tienes permiso para modificar esta subida")            
            
        # 3. Validar índices
        total_chunks = upload_info["total_chunks"]
        if chunk_index < 0 or chunk_index >= total_chunks:
            raise HTTPException(400, f"chunk_index debe estar entre 0 y {total_chunks - 1}")    
            
        # 4. Leer el contenido binario del chunk
        body = await request.body()
        if not body:
            raise HTTPException(400, "El chunk está vacío")
            
        # 5. Escribir el chunk al disco (usamos un formato con ceros iniciales para ordenarlos fácil luego)
        chunk_filename = f"chunk_{chunk_index:05d}"
        chunk_path = Path(CHUNKED_UPLOAD_DIR) / upload_id / chunk_filename
        
        # Usamos asyncio.to_thread para no bloquear el servidor con la escritura a disco        
        def guardar_disco():
            with open(chunk_path, "wb") as f:
                f.write(body)

        await asyncio.to_thread(guardar_disco)
        
        # 6. Actualizamos los chunks que ya llegaron
        upload_info["received_chunks"].add(chunk_index)
        
        # Logs de progreso: upload_id, chunk, % avance
        received_count = len(upload_info["received_chunks"])
        percentage = (received_count / total_chunks) * 100
        logger.info(
            "Upload WSI %s: Recibido chunk %d/%d (%.1f%%)",
            upload_id,
            chunk_index + 1,
            total_chunks,
            percentage
        )
        
        return {
            "status": "ok",
            "chunk_index": chunk_index,
            "received": received_count,
            "total": total_chunks
        }

    '''
        Este endpoint junta todas las piezas que bajó el de  chunk , ensambla el archivo completo, llama a
        la función nueva que pusimos en  service.py  para subirlo a GCS, lo guarda en la Base de Datos, y 
        por último borra la carpeta temporal para no llenar el disco.
    '''
    @app.post("/upload-wsi/complete/{upload_id}", tags=["Imágenes - WSI"])                      
    @limiter.limit("10/minute")                                                                 
    async def upload_wsi_complete(                                                              
        request: Request,                                                                       
        upload_id: str,                                                                         
        usuario: dict = Depends(obtener_usuario_actual)
    ):                                                                                          
        user_id = usuario["sub"]

        # 1. Validar estado                                                                     
        upload_info = uploads_pendientes.get(upload_id)                                         
        if not upload_info:                                                                     
            raise HTTPException(404, "Upload ID no encontrado o expirado")                      

        if upload_info["user_id"] != user_id:                                                   
            raise HTTPException(403, "No tienes permiso para completar esta subida")            

        # 2. Verificar que no falte ningún chunk                                                
        if len(upload_info["received_chunks"]) < upload_info["total_chunks"]:                   
            faltantes = upload_info["total_chunks"] - len(upload_info["received_chunks"])       
            raise HTTPException(400, f"Faltan {faltantes} chunks por subir")                    

        informe_id = upload_info["informe_id"]                                                  
        filename = upload_info["filename"]                                                      
        content_type = upload_info["content_type"]                                              

        upload_dir = Path(CHUNKED_UPLOAD_DIR) / upload_id                                       
        final_file_path = upload_dir / "assembled.wsi"                                          

        # 3. Ensamblar los chunks                                                               
        def ensamblar_chunks():                                                                 
            with open(final_file_path, "wb") as outfile:                                        
                for i in range(upload_info["total_chunks"]):                                    
                    chunk_path = upload_dir / f"chunk_{i:05d}"
                    with open(chunk_path, "rb") as infile:
                        shutil.copyfileobj(infile, outfile)

        logger.info("Ensamblando %d chunks para upload_id=%s", upload_info["total_chunks"], upload_id)
        await asyncio.to_thread(ensamblar_chunks)
        
        # Validación de tamaño físico real vs. tamaño declarado en init
        try:
            real_size = final_file_path.stat().st_size
        except Exception as e:
            logger.error("Error al obtener el tamaño del archivo ensamblado: %s", e)
            raise HTTPException(500, "Error al validar el archivo ensamblado")
            
        expected_size = upload_info["size"]
        if real_size != expected_size:
            logger.warning(
                "Inconsistencia de tamaño en upload %s: real=%d, esperado=%d. Cancelando.",
                upload_id, real_size, expected_size
            )
            # Limpieza inmediata de la carpeta temporal para no dejar basura
            shutil.rmtree(upload_dir, ignore_errors=True)
            uploads_pendientes.pop(upload_id, None)
            raise HTTPException(
                status_code=400,
                detail=f"El tamaño del archivo subido ({real_size} bytes) no coincide con el declarado originalmente ({expected_size} bytes)"
            )
        
        # 4. Generar nombre y subir a GCS
        filename_con_nombre = await service.generar_nombre_archivo(
            db, crud, informe_id, filename
        )
        wsi_location = f"wsi/{filename_con_nombre}"
        
        logger.info("Subiendo archivo ensamblado a GCS: %s", wsi_location)
        await asyncio.to_thread(
            service.subir_archivo_gcs_local,
            str(final_file_path),
            wsi_location,
            gcs_bucket,
            user_id,
            content_type
        )
        
        # 5. Guardar en Base de Datos (reutilizando el CRUD actual)
        imagen_db = await crud.create_imagen_with_type(
            db,
            ubicacion=wsi_location,
            informe_id=informe_id,
            tipo_imagen="wsi",
            usuario_id=user_id,
            ip=request.client.host if request.client else None,
        )
        
        # 6. Limpieza: borrar la carpeta en /tmp y borrar de memoria
        def limpiar_directorio():
            shutil.rmtree(upload_dir, ignore_errors=True)
            
        await asyncio.to_thread(limpiar_directorio)
        uploads_pendientes.pop(upload_id, None)
        
        logger.info("Upload chunked completado exitosamente: %s", imagen_db.id)
        return {
            "message": "WSI subido exitosamente",
            "imagen_id": imagen_db.id,
            "ubicacion": wsi_location,
            "tipo": "wsi"
        }