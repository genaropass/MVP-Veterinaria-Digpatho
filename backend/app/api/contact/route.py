import logging
import traceback
from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form
from typing import List, Optional
from app.api.contact import crud
from app.core.limiter import limiter

logger = logging.getLogger(__name__)

app = FastAPI()

MAX_FILES = 5


def add_contact_routes(app: FastAPI):
    @app.post("/api/contact", tags=["Contact"])
    @limiter.limit("5/minute")
    async def create_contact_request(
        request: Request,
        name: str = Form(...),
        email: str = Form(...),
        message: Optional[str] = Form(None),
        images: List[UploadFile] = File(...)
    ):
        """
        Endpoint público para recibir solicitudes de contacto/demo.
        
        Recibe:
        - name: Nombre del cliente
        - email: Email del cliente
        - message: Mensaje opcional
        - images: Hasta 5 imágenes (máx 5MB cada una)
        
        Guarda las imágenes en el filesystem y envía notificación por email.
        """
        try:
            # Validar número de imágenes
            if len(images) > MAX_FILES:
                raise HTTPException(
                    status_code=400,
                    detail=f"Máximo {MAX_FILES} imágenes permitidas"
                )
            
            if len(images) == 0:
                raise HTTPException(
                    status_code=400,
                    detail="Se requiere al menos una imagen"
                )
            
            # Validar email básico
            if "@" not in email:
                raise HTTPException(
                    status_code=400,
                    detail="Email inválido"
                )
            
            # Crear el registro en la DB primero para obtener el ID
            # Usaremos un ID temporal primero
            import uuid
            request_id = str(uuid.uuid4())
            
            # Guardar imágenes
            image_paths = await crud.save_images(images, request_id)
            
            # Crear registro en DB
            try:
                demo_request = await crud.create_demo_request(
                    name=name,
                    email=email,
                    message=message,
                    images=image_paths
                )
                
                # Enviar email de notificación (no crítico si falla)
                try:
                    crud.send_notification_email(
                        request_id=demo_request.id,
                        name=name,
                        email=email,
                        message=message,
                        image_paths=image_paths
                    )
                except Exception as email_error:
                    logger.warning("Error al enviar email (no crítico): %s", str(email_error))
                
                return {
                    "message": "Solicitud recibida correctamente",
                    "id": demo_request.id,
                    "status": "success"
                }
            except HTTPException as db_error:
                # Si es un error de base de datos (tabla no existe), devolver error claro
                if "no existe" in str(db_error.detail).lower() or "does not exist" in str(db_error.detail).lower():
                    raise HTTPException(
                        status_code=503,
                        detail="Servicio temporalmente no disponible. Por favor, contacte al administrador."
                    )
                raise
            
        except HTTPException as http_exc:
            # Re-agregar headers CORS a errores HTTP
            http_exc.headers = http_exc.headers or {}
            http_exc.headers["Access-Control-Allow-Origin"] = "*"
            http_exc.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
            http_exc.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Accept"
            raise http_exc
        except Exception as e:
            logger.exception("Error en create_contact_request: %s", str(e))
            error_detail = str(e)
            
            # Mensaje más amigable si es error de base de datos
            if "does not exist" in error_detail.lower() or "relation" in error_detail.lower() or "table" in error_detail.lower():
                error_detail = "Error de configuración del servidor. Por favor, contacte al administrador."
            
            raise HTTPException(
                status_code=500,
                detail=error_detail
            )
    
    @app.get("/api/contact/{request_id}", tags=["Contact"])
    async def get_contact_request(request_id: str):
        """
        Obtiene una solicitud de contacto por ID.
        Requiere autenticación (middleware global).
        """
        try:
            demo_request = await crud.get_demo_request(request_id)
            return demo_request
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error al obtener la solicitud: {str(e)}"
            )
    
    @app.get("/api/contact", tags=["Contact"])
    async def list_contact_requests(status: Optional[str] = None):
        """
        Lista todas las solicitudes de contacto.
        Opcionalmente filtradas por status (PENDING, PROCESSED, DONE).
        Requiere autenticación (middleware global).
        """
        try:
            demo_requests = await crud.get_all_demo_requests(status)
            return demo_requests
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error al obtener las solicitudes: {str(e)}"
            )

