import logging
import random
from prisma.models import Usuario
from prisma import Prisma
from prisma.errors import PrismaError
import bcrypt
from fastapi import HTTPException
from app.api.mail_send import crud
from app.api.user.token import crear_token, decodificar_token
from dotenv import load_dotenv
import os
from datetime import datetime, timezone
from app.api.audit.auditoria import registrar_auditoria, OperacionAuditoria
from fastapi import Request

logger = logging.getLogger(__name__)

# Cargar variables desde .env
load_dotenv()
host_front=os.getenv("HOST_FRONT")


async def create_user(db: Prisma, nombre: str, mail: str, password: str, ip: str = None) -> Usuario:
    try:
        existing_user = await db.usuario.find_unique(where={"mail": mail})
        if existing_user:
            raise HTTPException(status_code=409, detail="El correo ya está registrado.")

        password_hash = await hashear_password(password)

        # Crear usuario activo (sin verificación por email)
        user = await db.usuario.create({
            "mail": mail,
            "nombre": nombre,
            "password_hash": password_hash,
            "doble_factor": "000000",
            "doble_factor_exp": "",
            "creacion": str(int(datetime.now().timestamp())),
            "activo": True
        })
        await registrar_auditoria(
            tabla=user.__class__.__name__.lower(),
            operacion=OperacionAuditoria.CREAR,
            registro_id=user.id,
            datos_posteriores={"mail": mail, "nombre": nombre},
            ip=ip,
        )
        return user

    except HTTPException as http_exc:
        raise http_exc
    except PrismaError:
        logger.exception("Error de base de datos en create_user")
        raise HTTPException(status_code=500, detail="Error en la base de datos")
    except Exception:
        logger.exception("Error interno en create_user")
        raise HTTPException(status_code=500, detail="Error interno del servidor")



async def generar_codigo_2fa(db: Prisma, user_id:str, user_mail:str):
    codigo = f"{random.randint(100000, 999999)}"
    expiracion = str(int(datetime.now().timestamp())+300)

    await db.usuario.update(
        where={"id": user_id},
        data={"doble_factor": codigo, "doble_factor_exp": str(expiracion)}
    )
    mensaje_codigo=f"Utilice el siguiente codigo de acceso para verificar su mail: {codigo}. \nExpira en 5 minutos"

    # Intentar enviar email, pero no fallar si hay error (solo loguear)
    try:
        respuesta = crud.send_email(user_mail, "codigo de acceso digpatho ", mensaje_codigo)
    except HTTPException as http_exc:
        # SMTP falló (credenciales, etc.): no romper el flujo, el código ya está en BD
        logger.warning("Error al enviar email 2FA — user_id=%s: %s", user_id, http_exc.detail)
    except Exception as e:
        logger.exception("Error al enviar email 2FA — user_id=%s: %s", user_id, str(e))

    return {"codigo":codigo, "expiracion":expiracion}


async def verificar_2fa(db: Prisma, user, codigo, ip: str = None) -> dict:
# Comparar código y ver expiracion
    if user.doble_factor != codigo:
        await registrar_auditoria(
            tabla="usuario",
            operacion=OperacionAuditoria.LOGIN_FALLIDO,
            registro_id=user.id,
            usuario_id=user.id,
            ip=ip,
            datos_posteriores={"motivo": "2fa_codigo_incorrecto"},
        )
        raise HTTPException(status_code=401, detail="Código incorrecto.")

    expiracion = user.doble_factor_exp

    if ( int(expiracion) < int(datetime.now().timestamp())):
        await registrar_auditoria(
            tabla="usuario",
            operacion=OperacionAuditoria.LOGIN_FALLIDO,
            registro_id=user.id,
            usuario_id=user.id,
            ip=ip,
            datos_posteriores={"motivo": "2fa_codigo_expirado"},
        )
        raise HTTPException(status_code=401, detail="Código expirado.")

    # Si pasa validacion genero token y cambio estado a activo=true
    await db.usuario.update(
        where={"id": user.id},
        data={ "activo": True}
    )
    # Token con vencimiento según rol 'trial' a 3 dias
    # if user.rol == "TRIAL":
    #     exp = 259200
    # else:
    #     exp = timedelta(minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES")))

    token_de_acceso = crear_token.crear_access_token(
        data={"sub": user.id},
        expiracion= 259200 
    )

    await registrar_auditoria(
        tabla="usuario",
        operacion=OperacionAuditoria.DOS_FACTORES_VALIDADO,
        registro_id=user.id,
        usuario_id=user.id,
        ip=ip,
    )

    return {"access_token": token_de_acceso, "token_type": "bearer"}


async def get_user(db: Prisma, user_id: str) -> Usuario:
    """ Buscar un usuario por su ID en la base de datos.
    Parametros: instancia de la base de datos, ID del usuario.
    Retorna: Usuario si existe, None si no se encuentra."""
    try:
        user = await db.usuario.find_unique(where={"id": user_id})
        if not user or user.deleted_at is not None:
            raise HTTPException(status_code=404, detail="ID de usuario no encontrado.")
        return user

    except HTTPException:
        raise
    except PrismaError:
        logger.exception("Error de base de datos en get_user — user_id=%s", user_id)
        raise HTTPException(status_code=500, detail="Error en la base de datos")
    except Exception:
        logger.exception("Error interno en get_user — user_id=%s", user_id)
        raise HTTPException(status_code=500, detail="Error interno del servidor")


async def get_id_user(db: Prisma, mail: str) -> str:
    """ Buscar un usuario por su mail en la base de datos.
    Parametros: instancia de la base de datos, mail del usuario.
    Retorna: Usuario si existe, None si no se encuentra."""
    try:
        user = await db.usuario.find_unique(where={"mail": mail})
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        return user.id
    except HTTPException as http_exc:
        raise http_exc
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de mail inválido.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en la busqueda: {str(e)}")


async def get_all_users(db: Prisma) -> list[Usuario]:
    """ Obtiene todos los usuarios en la base de datos.
    Parametros: instancia de la base de datos.
    Retorna: Lista de usuarios."""
    try:
        return await db.usuario.find_many(where={"deleted_at": None})

    except PrismaError:
        logger.exception("Error de base de datos en get_all_users")
        raise HTTPException(status_code=500, detail="Error en la base de datos")
    except Exception:
        logger.exception("Error interno en get_all_users")
        raise HTTPException(status_code=500, detail="Error interno del servidor")


async def delete_user(db: Prisma, user_id: str, usuario_id: str = None, ip: str = None) -> bool:
    """Elimina un usuario por su ID.
    Parametros: instancia de la base de datos, ID del usuario a eliminar.
    Retorna: True si se eliminó correctamente, False si el usuario no existe."""
    try:
        user = await db.usuario.update(
            where={"id": user_id},
            data={"deleted_at": datetime.now(timezone.utc)},
        )
        if user:
            await registrar_auditoria(
                tabla=user.__class__.__name__.lower(),
                operacion=OperacionAuditoria.ELIMINAR,
                registro_id=user_id,
                datos_previos={"mail": user.mail, "nombre": user.nombre},
                usuario_id=usuario_id,
                ip=ip
            )
        return bool(user)

    except PrismaError:
        logger.exception("Error de base de datos en delete_user — user_id=%s", user_id)
        raise HTTPException(status_code=500, detail="Error en la base de datos")
    except Exception:
        logger.exception("Error interno en delete_user — user_id=%s", user_id)
        raise HTTPException(status_code=500, detail="Error interno del servidor")


async def login(db: Prisma, mail: str, password: str, ip: str = None) -> dict:
    """Autentica a un usuario y genera un token JWT.
    Parametros: instancia de la base de datos, datos de autenticación con nombre de usuario o correo y contraseña.
    Retorna: Token de acceso y tipo de token;
            Si las credenciales no son correctas lanza HTTPException: Si las credenciales son incorrectas."""
    try:
        try:
            user = await get_user_email(db, mail)
        except HTTPException as e:
            if e.status_code == 404:
                await registrar_auditoria(
                    tabla="usuario",
                    operacion=OperacionAuditoria.LOGIN_FALLIDO,
                    registro_id=mail,
                    ip=ip,
                    datos_posteriores={"motivo": "mail_no_registrado"},
                )
                raise HTTPException(status_code=400, detail="Verifique sus datos.")
            raise

        if user.deleted_at is not None:
            raise HTTPException(status_code=403, detail="Cuenta deshabilitada.")

        if not await verificar_password(password, user.password_hash):
            await registrar_auditoria(
                tabla="usuario",
                operacion=OperacionAuditoria.LOGIN_FALLIDO,
                registro_id=user.id,
                ip=ip,
            )
            raise HTTPException(status_code=400, detail="Verifique sus datos.")

        if user.activo != True:
            raise HTTPException(status_code=409, detail="El usuario no realizo la verificación 2FA.")

        # Token con vencimiento según rol 'trial' a 3 dias
        # if user.rol == "TRIAL":
        #     exp = str( 259200-(int(datetime.now().timestamp()) - int(user.creacion)))
        #Definir tiempos para otros roles

        token_de_acceso = crear_token.crear_access_token(
            data={"sub": user.id},
            expiracion=259200
        )

        await registrar_auditoria(
            tabla="usuario",
            operacion=OperacionAuditoria.LOGIN,
            registro_id=user.id,
            usuario_id=user.id,
            ip=ip,
        )

        return {"access_token": token_de_acceso, "token_type": "bearer"}

    except HTTPException as http_exc:
        raise http_exc
    except Exception:
        logger.exception("Error interno en login")
        raise HTTPException(status_code=500, detail="Error interno del servidor")


async def hashear_password(password: str) -> str:
    """Hashea la contraseña de forma segura usando bcrypt.
    Parametros: contraseña en texto plano.
    Retorna: contraseña hasheada."""
    try:
        hashed_password = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
        return hashed_password.decode("utf-8")
    except Exception:
        logger.exception("Error al hashear la contraseña")
        raise HTTPException(status_code=500, detail="Error al hashear la contraseña")


async def verificar_password(password: str, passwordBD: str) -> bool:
    """Compara una contraseña ingresada con la almacenada en la base de datos.
    Parametros: Contraseña ingresada por el usuario. Contraseña almacenada en la base de datos (hasheada).
    Retorna: True si la contraseña es la correcta, False si no lo es."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), passwordBD.encode("utf-8"))
    except Exception as e:
        logger.exception("Error al verificar la contraseña: %s", str(e))
        return False


async def get_user_email(db: Prisma, mail: str) -> Usuario:
    """Obtiene un usuario por su email.
    Parametro: instancia de la base de datos, mail del usuario..
    Retorna: Usuario si existe, None si no se encuentra."""
    try:
        user = await db.usuario.find_unique(where={"mail": mail})
        if not user:
            raise HTTPException(status_code=404, detail="Correo no registrado.")
        return user
    except HTTPException:
        raise
    except PrismaError:
        logger.exception("Error de base de datos en get_user_email")
        raise HTTPException(status_code=500, detail="Error en la base de datos")
    except Exception:
        logger.exception("Error interno en get_user_email")
        raise HTTPException(status_code=500, detail="Error interno del servidor")


async def get_user_nombre(db: Prisma, nombre: str) -> Usuario:
    """Obtiene un usuario por su nombre.
    Parametro: instancia de la base de datos, nombre del usuario.
    Retorna: Usuario si existe, None si no se encuentra."""
    try:
        user = await db.usuario.find_unique(where={"nombre": nombre})
        if not user:
            raise HTTPException(status_code=404, detail="Nombre no registrado.")
        return user
    except HTTPException:
        raise
    except PrismaError:
        logger.exception("Error de base de datos en get_user_nombre")
        raise HTTPException(status_code=500, detail="Error en la base de datos")
    except Exception:
        logger.exception("Error interno en get_user_nombre")
        raise HTTPException(status_code=500, detail="Error interno del servidor")


async def update_email(db: Prisma, mail: str, mail_nuevo: str, ip: str = None) -> bool:
    """Actualiza el mail de un usuario en la base de datos.
    Parametros: instancia de la base de datos, id del usuario y nuevo mail.
    Retorna: True si la actualización fue exitosa, False si el usuario no fue encontrado."""
    try:
        user = await db.usuario.find_first(where={"mail": mail})
        if not user:
            return False

        await db.usuario.update(
            where={"id": user.id},
            data={"mail": mail_nuevo}
        )
        await registrar_auditoria(
            tabla="usuario",
            operacion=OperacionAuditoria.ACTUALIZAR,
            registro_id=user.id,
            datos_previos={"mail": mail},
            datos_posteriores={"mail": mail_nuevo},
            ip=ip,
        )
        return True
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Error al actualizar el correo electrónico.")


async def forgot_password(db:Prisma, email: str):
    """Consulta en la base de datos si el email existe y envia email con token.
    Parametro: instancia de la base de datos, email.
    Retorna: "message": "Se envio el token temporal {email}"""
    try:
        datoUsuario= await get_user_email(db, email)
        # si el email es igual a None notificar al cliente de cuenta inexistente, ver que va a devolver el metodo
        token_5_min=crear_token.crear_access_token(data={"sub": datoUsuario.id},expiracion=300)
        asunto="recuperacion de contraseña"
        cuerpoEmail=f"Para cambiar su contraseña debe seguir el siguiente enlace: => {host_front}/auth/reset-password/{token_5_min}"
        crud.send_email(email,asunto,cuerpoEmail)

        return {"message": f"Se envio el token temporal {email}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(e)


async def reset_password_confirm(db: Prisma, token: str, password: str, ip: str = None):
    """Modifica la contraseña solo con el token.
    Recibe: instancia de la base de datos, token, y password
    Retorna: "message": "Contraseña actualizada" """
    try:
        datosToken = decodificar_token.obtener_usuario_actual(token)
        user_id = datosToken["sub"]
        await update_password(db, user_id, password)
        await registrar_auditoria(
            tabla="usuario",
            operacion=OperacionAuditoria.ACTUALIZAR,
            registro_id=user_id,
            usuario_id=user_id,
            datos_posteriores={"campo": "password_hash", "motivo": "reset_password"},
            ip=ip,
        )
        return {"message": "Contraseña actualizada."}
    except HTTPException:
        raise


async def update_password(db: Prisma, id: str, password: str) -> bool:
    """Genera una nueva contraseña y la guarda en la base de datos.
    Recibe: instancia de la base de datos, id del usuario y password.
    Retorna: True si la actualización fue exitosa, False si el usuario no fue encontrado."""
    try:
        user = await db.usuario.find_unique(where={"id": id})
        if not user:
            return False

        password_hasheado = await hashear_password(password)
        await db.usuario.update(
            where={"id": user.id},
            data={"password_hash": password_hasheado}
        )
        return True
    except HTTPException:
        raise
