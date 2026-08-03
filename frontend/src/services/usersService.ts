import { API_TOKEN, HOST } from "@/utils/constants";

interface RegisterUserResponse {
  success: boolean;
  message: string;
  email?: string;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
}

export async function registerUser(
  name: string,
  email: string,
  password: string
): Promise<RegisterUserResponse> {
  const response = await fetch(`${HOST}users/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({
      nombre: name,
      mail: email,
      password,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();

    if (response.status === 422) {
      throw new Error(errorData?.detail?.[0]?.msg || "Error de validación");
    }

    if (response.status === 409) {
      throw new Error(errorData?.detail?.[0]?.msg || "El correo ya está registrado");
    }

    if (response.status === 403) {
      return {
        success: true,
        message: "Verifica tu email para continuar. Redirigiendo...",
        email,
      };
    }

    throw new Error(errorData?.detail?.[0]?.msg || "Error al crear usuario");
  }

  return {
    success: true,
    message: "Usuario creado exitosamente",
    email,
  };
}

export async function loginUser(email: string, password: string): Promise<LoginResponse | null> {
  console.log("host: ", HOST)
  console.log("process.env.NEXT_PUBLIC_API_URL: ", process.env.NEXT_PUBLIC_API_URL)
  const response = await fetch(`${HOST}users_login/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({ mail: email, password }),
  });

  if (!response.ok) {
    return null; 
  }

  return await response.json();
}

/*Obtiene el ID del usuario a partir del email*/
export async function fetchUserIdByEmail(email: string): Promise<string> {
  const response = await fetch(`${HOST}users/${email}`, {
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error("No se pudo obtener el ID del usuario");
  }

  return await response.json(); 
}

/*Verifica si un usuario existe por email (retorna true/false)*/
export async function userExists(email: string): Promise<boolean> {
  const response = await fetch(`${HOST}users/${email}`, {
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
    },
  });

  return response.status === 200;
}

export async function validate2FACode(email: string, token: string): Promise<void> {
  const res = await fetch(`${HOST}verificar_2fa/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({
      mail: email,
      codigo: token,
    }),
  });

  if (!res.ok) {
    if (res.status === 422) {
      const errData = await res.json();
      throw new Error(errData?.detail?.[0]?.msg || "Código inválido");
    } else {
      throw new Error("Error al verificar el código");
    }
  }
}

export async function forgotPassword(email: string) {
  try {
    const response = await fetch(`${HOST}forgot_password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({ mail: email }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Error en recuperación:", error);
      throw new Error("No se pudo enviar el mail de recuperación");
    }
    
    const message = await response.json();
    console.log("Token de recuperación recibido:", message);
    return message;
  } catch (error) {
    console.error("Error al enviar recuperación:", error);
    throw error;
  }
}

export async function resetPassword(token: string, newPassword: string) {
  try {
    const response = await fetch(`${HOST}reset_password/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({ token, password: newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Error al cambiar la contraseña:", error);
      throw new Error("No se pudo cambiar la contraseña");
    }

    const message = await response.json(); // string
    console.log("Respuesta del backend:", message);
    return message;
  } catch (error) {
    console.error("Error al confirmar nueva contraseña:", error);
    throw error;
  }
}
