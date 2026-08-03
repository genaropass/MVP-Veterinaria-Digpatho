import logging
import os
import smtplib
import json
from pathlib import Path
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import List, Optional, Any
from fastapi import HTTPException, UploadFile
from prisma.errors import PrismaError
from prisma import types
from app.api.database import db

logger = logging.getLogger(__name__)

# Configuración de directorio de uploads
# En EC2 usar: /var/www/uploads/demo-requests
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/var/www/uploads/demo-requests")
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB por imagen
MAX_FILES = 5

# Configuración SMTP
SMTP_HOST = os.getenv("SMTP_HOST", "mail.digpatho.com")  # Servidor SMTP
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))  # Puerto SMTP (587 para TLS, 465 para SSL)
MAIL = os.getenv("MAIL")  # Usuario SMTP (puede ser "apikey" para SendGrid o email)
PASSWORD = os.getenv("PASSWORD")  # Contraseña SMTP (API Key para SendGrid)
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "noreply@digpatho.com")  # Email remitente (debe ser del dominio)
NOTIFICATION_EMAIL = os.getenv("NOTIFICATION_EMAIL")  # Email donde recibir notificaciones


def ensure_upload_dir():
    """Crea el directorio de uploads si no existe"""
    try:
        Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
        # Asegurar permisos adecuados
        os.chmod(UPLOAD_DIR, 0o755)
    except PermissionError as e:
        logger.error("Error de permisos al crear directorio %s: %s", UPLOAD_DIR, str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Error de permisos al crear directorio de uploads: {str(e)}"
        )
    except Exception as e:
        logger.error("Error al crear directorio %s: %s", UPLOAD_DIR, str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Error al crear directorio de uploads: {str(e)}"
        )


def validate_image(file: UploadFile) -> None:
    """Valida que el archivo sea una imagen válida"""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"El archivo {file.filename} no es una imagen válida"
        )


async def save_images(files: List[UploadFile], request_id: str) -> List[str]:
    """Guarda las imágenes en el filesystem y retorna las rutas"""
    try:
        ensure_upload_dir()
        
        # Crear directorio específico para este request
        request_dir = Path(UPLOAD_DIR) / request_id
        request_dir.mkdir(parents=True, exist_ok=True)
        
        saved_paths = []
        
        for idx, file in enumerate(files):
            try:
                # Validar tipo
                validate_image(file)
                
                # Validar tamaño
                contents = await file.read()
                if len(contents) > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=400,
                        detail=f"La imagen {file.filename} excede el tamaño máximo de 5MB"
                    )
                
                # Generar nombre único
                file_extension = Path(file.filename).suffix if file.filename else ".jpg"
                file_name = f"{idx + 1}_{file.filename or 'image'}{file_extension}"
                file_path = request_dir / file_name
                
                # Guardar archivo
                with open(file_path, "wb") as f:
                    f.write(contents)
                
                # Guardar ruta relativa para la DB
                saved_paths.append(str(file_path))
            except HTTPException:
                raise
            except Exception as e:
                logger.exception("Error al guardar imagen %s", file.filename)
                raise HTTPException(
                    status_code=500,
                    detail=f"Error al guardar imagen {file.filename}: {str(e)}"
                )

        return saved_paths
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error en save_images: %s", str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Error al guardar imágenes: {str(e)}"
        )


async def create_demo_request(
    name: str,
    email: str,
    message: Optional[str],
    images: List[str]
) -> dict:
    """Crea un nuevo demo request en la base de datos"""
    try:
        # Prisma Python tiene problemas con campos Json, usar SQL directo
        import uuid
        request_id = str(uuid.uuid4())
        
        # Asegurar que images sea una lista válida
        if not isinstance(images, list):
            images = list(images) if images else []
        
        # Serializar images a JSON para PostgreSQL
        images_json_str = json.dumps({"paths": images})
        
        # Usar consulta SQL directa para evitar problemas con tipo Json de Prisma Python
        query = """
            INSERT INTO "DemoRequest" (id, name, email, message, images, status, "createdAt")
            VALUES ($1, $2, $3, $4, $5::jsonb, $6::"DemoRequestStatus", NOW())
        """
        
        await db.execute_raw(
            query,
            request_id,
            name,
            email,
            message if message else None,
            images_json_str,
            "PENDING"
        )
        
        # Obtener el registro creado usando Prisma
        demo_request = await db.demorequest.find_unique(where={"id": request_id})
        
        if not demo_request:
            raise HTTPException(
                status_code=500,
                detail="Error al recuperar el registro creado"
            )
        
        return demo_request
    except PrismaError as e:
        logger.exception("Error de base de datos en create_demo_request")
        error_msg = str(e)
        # Verificar si es porque la tabla no existe
        if "does not exist" in error_msg or "relation" in error_msg.lower():
            raise HTTPException(
                status_code=500,
                detail="La tabla DemoRequest no existe. Ejecuta la migración de Prisma: prisma migrate deploy"
            )
        raise HTTPException(
            status_code=500,
            detail=f"Error de base de datos al guardar la solicitud: {str(e)}"
        )
    except Exception as e:
        logger.exception("Error en create_demo_request: %s", str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Error al guardar la solicitud: {str(e)}"
        )


def send_notification_email(
    request_id: str,
    name: str,
    email: str,
    message: Optional[str],
    image_paths: List[str]
) -> None:
    """Envía un email de notificación al encargado"""
    # Usar credenciales de contacto@digpatho.com (cPanel) que funcionan con mail.digpatho.com
    # El destinatario (NOTIFICATION_EMAIL) puede ser cualquier email, no necesita credenciales
    if not MAIL or not PASSWORD:
        # Si no hay configuración SMTP, solo loguear (no fallar)
        logger.warning("SMTP no configurado. Nueva demo request: %s", request_id)
        return
    
    msg = MIMEMultipart()
    msg["Subject"] = f"Nueva solicitud de demo - {name}"
    msg["From"] = SMTP_FROM_EMAIL  # Email remitente (debe ser del dominio para SendGrid)
    msg["To"] = NOTIFICATION_EMAIL  # Destinatario
    
    # Cuerpo del email (sin ID y sin rutas de archivos)
    body = f"""Nueva solicitud de demo recibida

Nombre: {name}
Email: {email}

Mensaje:
{message or '(Sin mensaje)'}

Las imágenes están adjuntas en este email.
"""
    
    part = MIMEText(body, "plain")
    msg.attach(part)
    
    # Adjuntar imágenes
    for image_path in image_paths:
        try:
            if os.path.exists(image_path):
                with open(image_path, "rb") as attachment:
                    # Obtener el nombre del archivo sin la ruta completa
                    filename = os.path.basename(image_path)
                    
                    # Crear el adjunto
                    part = MIMEBase("application", "octet-stream")
                    part.set_payload(attachment.read())
                    
                    # Codificar en base64
                    encoders.encode_base64(part)
                    
                    # Agregar headers
                    part.add_header(
                        "Content-Disposition",
                        f"attachment; filename= {filename}",
                    )
                    
                    msg.attach(part)
            else:
                logger.warning("Imagen no encontrada: %s", image_path)
        except Exception as e:
            logger.warning("Error al adjuntar imagen %s: %s", image_path, str(e))
            # Continuar con las demás imágenes
    
    try:
        # Usar servidor SMTP configurado (por defecto mail.digpatho.com, pero configurable)
        if SMTP_PORT == 465:
            # SSL
            import ssl
            context = ssl.create_default_context()
            server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context)
        else:
            # TLS (puerto 587 por defecto)
            server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        
        try:
            if SMTP_PORT != 465:
                server.starttls()
            server.login(MAIL, PASSWORD)
        except smtplib.SMTPAuthenticationError as auth_error:
            # Error de autenticación - credenciales incorrectas
            logger.warning(
                "Error de autenticación SMTP: %s — Verifica que MAIL y PASSWORD sean correctos en .env — Servidor: %s:%s — Usuario intentado: %s",
                str(auth_error), SMTP_HOST, SMTP_PORT, MAIL
            )
            server.quit()
            return  # No fallar, solo loguear
        except Exception as login_error:
            logger.warning("Error al autenticar SMTP: %s", str(login_error))
            server.quit()
            return

        server.sendmail(SMTP_FROM_EMAIL, NOTIFICATION_EMAIL, msg.as_string())
        server.quit()
        logger.info("Email de notificación enviado desde %s a %s", SMTP_FROM_EMAIL, NOTIFICATION_EMAIL)
    except Exception as e:
        # No fallar si el email no se puede enviar, solo loguear
        logger.warning("Error al enviar email de notificación: %s: %s", type(e).__name__, str(e))


async def get_demo_request(request_id: str) -> dict:
    """Obtiene un demo request por ID"""
    try:
        demo_request = await db.demorequest.find_unique(
            where={"id": request_id}
        )
        if not demo_request:
            raise HTTPException(status_code=404, detail="Solicitud no encontrada")
        
        # Convertir el campo images de diccionario a lista si es necesario
        if isinstance(demo_request.images, dict) and "paths" in demo_request.images:
            demo_request_dict = demo_request.model_dump() if hasattr(demo_request, 'model_dump') else dict(demo_request)
            demo_request_dict["images"] = demo_request.images["paths"]
            return demo_request_dict
        
        return demo_request
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener la solicitud: {str(e)}"
        )


async def get_all_demo_requests(status: Optional[str] = None) -> List[dict]:
    """Obtiene todas las solicitudes, opcionalmente filtradas por status"""
    try:
        where_clause = {}
        if status:
            where_clause["status"] = status
        
        demo_requests = await db.demorequest.find_many(
            where=where_clause,
            order={"createdAt": "desc"}
        )
        
        # Convertir el campo images de diccionario a lista si es necesario
        result = []
        for req in demo_requests:
            req_dict = req.model_dump() if hasattr(req, 'model_dump') else dict(req)
            if isinstance(req.images, dict) and "paths" in req.images:
                req_dict["images"] = req.images["paths"]
            result.append(req_dict)
        
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener las solicitudes: {str(e)}"
        )

