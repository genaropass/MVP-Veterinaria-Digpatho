from fastapi import FastAPI, HTTPException, Depends, Request
from app.api.database import db
from app.api.user import crud
from app.core.limiter import limiter
from app.api.user.models import UsuarioCreate, UsuarioLogin, UsuarioMail2FA, UsuarioUpdateMail,UsuarioEmail, UsuarioToken
from app.api.user.token.decodificar_token import obtener_usuario_actual
from fastapi.security import OAuth2PasswordRequestForm
import uuid
from prisma.errors import PrismaError
import logging

logger = logging.getLogger(__name__) 


def add_user_routes(app: FastAPI):

    @app.post("/users/", tags=["Usuarios"])
    @limiter.limit("5/minute")
    async def create_user(usuarioCreate: UsuarioCreate, request: Request):
        """Crear usuario en la base de datos.
        Parametro: mail.
        Retorna: mensaje con id del usuario creado. """
        try:
            # Log para debugging
            logger.info("Intento de registro — Nombre: %s", usuarioCreate.nombre)
            
            await crud.create_user(db, usuarioCreate.nombre, usuarioCreate.mail,  
                                   usuarioCreate.password, 
                                   ip=request.client.host if request.client else None)                
            return {"message": "Usuario creado con exito"}
        except HTTPException as e:
            logger.error(f"HTTPException en create_user: {e.status_code} - {e.detail}")
            raise HTTPException(status_code=e.status_code, detail=e.detail)
        except Exception as e:
            logger.exception("Error inesperado en create_user")
            raise HTTPException(status_code=500, detail=f"Error desconocido al crear el usuario: {str(e)}")

    @app.post("/verificar_2fa/", tags=["Usuarios"])
    @limiter.limit("10/minute")
    async def verificar_2fa(UsuarioMail2FA: UsuarioMail2FA, request: Request):
        try:
            user = await db.usuario.find_unique(where={"mail": UsuarioMail2FA.mail})
            if not user:
                raise HTTPException(status_code=404, detail="Usuario no encontrado.")
            return await crud.verificar_2fa(db, user, UsuarioMail2FA.codigo, ip=request.client.host if request.client else None)
        except HTTPException as e:
            raise HTTPException(status_code=e.status_code, detail=e.detail)
        except Exception:
            raise HTTPException(status_code=500, detail="Error desconocido al generar token de usuario.")
 
  

    @app.post("/users_login/", tags=["Usuarios"])
    @app.post("/users_login", tags=["Usuarios"])
    @limiter.limit("10/minute")
    async def login(usuarioLogin: UsuarioLogin, request: Request):
        """El usuario podra loguearse de forma manual.
        Parametro: OAuth2PasswordRequestForm de FastAPI. Recibe el email o el nombre y la contraseña.
        Retorna: Token o mensaje para verificar sus datos. """
        try:
            return await crud.login(db, usuarioLogin.mail, usuarioLogin.password, ip=request.client.host if request.client else None)

        except HTTPException as e:
            raise HTTPException(status_code=e.status_code, detail=e.detail)
        except Exception:
            raise HTTPException(status_code=500, detail="Error desconocido en el inicio de sesion.")
    
    
        
    @app.post("/forgot_password", tags= ["Usuarios"])
    @limiter.limit("5/minute")
    async def forgot_password(email:UsuarioEmail, request: Request):
        """Recupera contraseña olvidada.
        Body: email.
        Retorna: Token temporal(valido 5 minutos) y envia email."""
        try:
            return await crud.forgot_password(db, email.mail)
        except HTTPException as e:
            raise HTTPException(status_code=e.status_code, detail=e.detail)
        except Exception:
            raise HTTPException(status_code=500, detail="Error desconocido en el inicio de sesion.")


    @app.post("/reset_password/confirm",tags=["Usuarios"])
    @limiter.limit("5/minute")
    async def reset_password_confirm(usuarioToken:UsuarioToken, request: Request):
        """Verifica que el token sea veridico y pertenezca a un usuario que exista en la db, si es correcto se guarda el hash de la contraseña
        Body: Token y password.
        Retorna: message: Su constraseña se actualizo de forma correcta o error"""
        try:
            return await crud.reset_password_confirm(db, usuarioToken.token, usuarioToken.password, ip=request.client.host)
        except HTTPException as e:
            raise HTTPException(status_code=e.status_code, detail=e.detail)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error {e}")



    @app.put("/users/actualizar_email", tags=["Usuarios"])
    async def update_email(usuarioUpdateMail: UsuarioUpdateMail, request: Request):
        """Permite actualizar el mail del usuario.
        Parametro: mail.
        Retorna: mensaje de exito de actualizacion o mensaje de error."""
        try:
            mailUpdate = await crud.update_email(db, usuarioUpdateMail.mail, usuarioUpdateMail.mail_nuevo, ip=request.client.host if request.client else None)
            if not mailUpdate:
                raise HTTPException(status_code=404, detail="No se pudo encontrar el usuario para actualizar el mail")
            return {"message": "Mail actualizado correctamente"}
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error al actualizar el correo electrónico.")
        
        

    @app.get("/users/{mail}", tags=["Usuarios"])
    async def get_id_user(mail: str):
        """Obtener un ID por mail de usuairo.
        Recibe: Mail del usuario. 
        Retorna: ID del usuario buscado o algun mensaje de error"""
        try:
            user_id= await crud.get_id_user(db, mail)
            return {"message": user_id}
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error desconocido al buscar id.")       
        

    @app.get("/users_id/{user_id}", tags=["Usuarios"])
    async def get_user(user_id: str):
        """Obtener un usuario por ID.
        Recibe: ID del usuario. 
        Retorna: ID y nombre del usuario buscado o algun mensaje de error"""
        try:
            uuid.UUID(user_id)  # Validar si ID es UUID
            user = await crud.get_user(db, user_id)
            if not user:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
            return {"message": {"id": user.id, "mail": user.mail}}
        except ValueError:
            raise HTTPException(status_code=400, detail="ID invalido, debe tener 36 caracteres.")
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error al obtener usuario por ID.")
        
        

    @app.get("/users/", tags=["Usuarios"])
    async def list_users(request: Request):
        """ Obtener la lista de usuarios.
        Retorna: lista de diccionarios (ID, nombre)"""
        try:
            users = await crud.get_all_users(db)
            return [{"id": u.id, "mail": u.mail} for u in users]
        except Exception:
            raise HTTPException(status_code=500, detail="Error al obtener la lista de usuarios.")
        
        

    @app.delete("/users/{user_id}", tags=["Usuarios"])
    async def delete_user(user_id: str, request: Request, usuario: dict = Depends(obtener_usuario_actual)):
        """ Eliminar un usuario.
        Recibe: id del usuario a eliminar.
        Retorna: mensaje que notifica si se elimina o mensaje de error"""
        try:
            uuid.UUID(user_id)  # Validar si ID es UUID
            deleted = await crud.delete_user(db, user_id, usuario_id=usuario["sub"], ip=request.client.host if request.client else None)
            if not deleted:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
            return {"message": "Usuario eliminado"}
        except ValueError:
            raise HTTPException(status_code=400, detail="ID invalido, debe tener 36 caracteres.")
        except HTTPException as http_exc:
            raise http_exc
        except Exception:
            raise HTTPException(status_code=500, detail="Error al eliminar usuario.")
