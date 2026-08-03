from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt, ExpiredSignatureError
from dotenv import load_dotenv
from prisma.enums import Role
import os

# Cargar variables desde .env
load_dotenv()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl='users_login')

def obtener_usuario_actual(token: str = Depends(oauth2_scheme)):
    """Decodifica y valida el token JWT.
    Recibe: TOKEN.
    Retorna: {"sub": "id"}
    Lanza HTTP 401 si el token es inválido, expirado o mal formado.
    """
    try:
        payload = jwt.decode(
            token,
            key=os.getenv('SECRET_KEY'),
            algorithms=[os.getenv('ALGORITHM')]   # FIX: debe ser una lista
        )
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=401,
                detail="Token inválido: campo 'sub' ausente"
            )
        return {"sub": user_id}
    except ExpiredSignatureError:
        # 401 explícito → el frontend lo intercepta y fuerza logout
        raise HTTPException(status_code=401, detail="Token expirado")
    except JWTError as e:
        # FIX: antes era raise HTTPException(e) que pasaba el objeto como status_code
        raise HTTPException(status_code=401, detail=f"Token inválido: {str(e)}")
        # LÍNEA ORIGINAL (crasehaba devolviendo 500):
        # raise HTTPException(e)


async def verificar_admin(usuario: dict = Depends(obtener_usuario_actual)):
    """Verifica que el usuario autenticado tenga rol ADMIN o SUPERADMIN."""
    from app.api.database import db
    user = await db.usuario.find_unique(where={"id": usuario["sub"]})
    if not user or user.rol not in (Role.ADMIN, Role.SUPERADMIN):
        raise HTTPException(status_code=403, detail="Acceso restringido a administradores.")
    return usuario
