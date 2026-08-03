import { auth } from "@/lib/auth";
import { NextResponse, type NextRequest } from "next/server";

/**
 * @remarks
 * Exporta la función `auth` como middleware para la autenticación.
 */
export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/wsi/tiles-v2")) {
    return NextResponse.next();
  }
  const session = await auth();

  if (!session || !session.user) {
    const signInUrl = req.nextUrl.clone();
    signInUrl.pathname = "/auth/sign-in";
    // Optionally append a callback URL if desired, e.g. signInUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

/**
 * @remarks
 * Configuración del middleware de autenticación.
 * - matcher: Define las rutas que utilizarán el middleware de autenticación (en este caso, la ruta `/profile`).
 * 
 */
export const config = {
  matcher: ["/profile/:path*", "/settings", "/wsi", "/bots", "/api/wsi/:path*"],
};
