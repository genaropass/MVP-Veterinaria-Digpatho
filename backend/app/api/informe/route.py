import json
import uuid
from fastapi import Depends, FastAPI, HTTPException, Request
from app.api.database import db
from app.api.informe import crud
from app.api.informe.models import InformeCreate, InformeUpdatePromedio
from app.api.user.token.decodificar_token import obtener_usuario_actual
from app.api.audit.auditoria import registrar_auditoria, OperacionAuditoria

def add_informe_routes(app: FastAPI):

    @app.post("/informe/", tags=["Informe"])
    async def create_informe(informeCreate: InformeCreate, request: Request, usuario_actual: dict = Depends(obtener_usuario_actual)):
        """Permite insertar a un nuevo informe en la base de datos.
        Recibe: instancia de base de datos, fecha de muestra, paciente Id y tipo de estudio.
        retorna un mensaje de que el informe fue cargado con exito"""
        try:
            informe = await crud.create_informe(db, informeCreate, usuario_id=usuario_actual["sub"], ip=request.client.host if request.client else None)
            return informe
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error desconocido al crear informe.")

    @app.get("/informe/", tags=["Informe"])
    async def list_informes(request: Request, usuario_actual: dict = Depends(obtener_usuario_actual)):
        """
        Conseguir un objeto de informes.
        Retorna: lista de diccionarios
        """
        try:
            informes = await crud.get_all_informes(db)
            await registrar_auditoria(
                tabla="informe",
                operacion=OperacionAuditoria.LEER,
                registro_id="*",
                usuario_id=usuario_actual["sub"],
                ip=request.client.host if request.client else None,
            )
            return informes
        except Exception:
            raise HTTPException(status_code=500, detail="Error al obtener informes.")

    @app.get("/informe/{informe_id}", tags=["Informe"])
    async def get_informe_id(informe_id: str, request: Request, usuario_actual: dict = Depends(obtener_usuario_actual)):
        """ Conseguir 1 informe segun su id."""
        try:
            informe = await crud.get_informe_id(db, informe_id, usuario_id=usuario_actual["sub"], ip=request.client.host if request.client else None)
            return informe
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error al obtener informe.")


    @app.get("/informe/paciente_id/{paciente_id}", tags=["Informe"])
    async def list_informes_por_paciente(paciente_id: str, request: Request, usuario_actual: dict = Depends(obtener_usuario_actual)):
        """
        Conseguir un objeto de informes condicionado por id de paciente.
        Recibe: id del paciente
        Retorna: lista de diccionarios
        """
        try:
            informes = await crud.list_informes_por_paciente(db, paciente_id, usuario_id=usuario_actual["sub"], ip=request.client.host if request.client else None)
            return informes
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error al obtener informes del paciente.")


    @app.put("/informe/{informe_id}", tags=["Informe"])
    async def update_promedio_rta_img(InformeUpdatePromedio: InformeUpdatePromedio, request: Request, usuario_actual: dict = Depends(obtener_usuario_actual)):
        """
        Permite actualizar informacion de resultado de las imagenes.
        Recibe: modelo de informe con id y string.
        Retorna: mensaje de exito de actualizacion o mensaje de error.
        """
        try:
            uuid.UUID(InformeUpdatePromedio.id)
        except ValueError:
            raise HTTPException(status_code=400, detail="ID invalido, debe tener 36 caracteres.")

        try:
            json_string = InformeUpdatePromedio.promedio_rta_img
            await crud.update_promedio(db, InformeUpdatePromedio.id, json_string, usuario_id=usuario_actual["sub"], ip=request.client.host if request.client else None)
            return {"message": "Promedio actualizado correctamente"}

        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error desconocido al actualizar promedio.")


    @app.delete("/informe/{informe_id}", tags=["Informe"])
    async def delete_informe_id(informe_id: str, request: Request, usuario_actual: dict = Depends(obtener_usuario_actual)):
        """
        Eliminar 1 informe segun su id.
        Retorna: mensaje que informa eliminacion
        """
        try:
            await crud.delete_informe_id(db, informe_id, usuario_id=usuario_actual["sub"], ip=request.client.host if request.client else None)
            return {"message": "Informe eliminado con exito"}
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error al eliminar informe.")