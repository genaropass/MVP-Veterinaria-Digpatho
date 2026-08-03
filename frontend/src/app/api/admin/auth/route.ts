import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (typeof process.env.ADMIN_PASSWORD === "undefined" || process.env.ADMIN_PASSWORD === "") {
  console.warn("[admin/auth] ADMIN_PASSWORD is not set on the server; login to /admin panel will always fail. Set it in .env.production or .env.local and restart.");
}

// Configurar timeout para esta ruta (si es posible en Next.js)
export const maxDuration = 5; // 5 segundos máximo para esta ruta

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parsear el body de forma más eficiente y rápida
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request format" },
        { status: 400 }
      );
    }
    
    if (!body?.password) {
      return NextResponse.json(
        { error: "Password required" },
        { status: 400 }
      );
    }

    // Normalizar la contraseña recibida (eliminar espacios al inicio y final)
    const normalizedPassword = String(body.password).trim();
    
    // Comparar contraseña (operación instantánea)
    if (!ADMIN_PASSWORD || normalizedPassword !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 401 }
      );
    }

    // Establecer cookie de sesión de admin (operación rápida)
    try {
      const cookieStore = await cookies();
      cookieStore.set("admin_session", "authenticated", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // 24 horas
        path: "/",
      });
    } catch (cookieError) {
      // Si falla la cookie, aún así retornar éxito (la autenticación fue correcta)
      console.error("Error setting cookie (non-critical):", cookieError);
    }

    const duration = Date.now() - startTime;
    if (duration > 1000) {
      console.warn(`Authentication took ${duration}ms (longer than expected)`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Authentication error after ${duration}ms:`, error);
    return NextResponse.json(
      { error: "Authentication error" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("admin_session");
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Error signing out" },
      { status: 500 }
    );
  }
}

