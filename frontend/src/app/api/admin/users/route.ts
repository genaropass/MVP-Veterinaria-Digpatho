import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { HOST, API_TOKEN } from "@/utils/constants";

// Verificar si el usuario está autenticado como admin
async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const adminSession = cookieStore.get("admin_session");
  return adminSession?.value === "authenticated";
}

// GET - Obtener lista de usuarios desde el backend
export async function GET(request: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Obtener parámetros de paginación
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Llamar al backend para obtener todos los usuarios
    // Intentar diferentes endpoints posibles
    const possibleEndpoints = [
      `${HOST}users/all/`,
      `${HOST}users/all`,
      `${HOST}users/`,
      `${HOST}admin/users/`,
      `${HOST}admin/users/all/`,
    ];

    let allUsers: any[] = [];
    let backendError: Error | null = null;

    // Intentar cada endpoint con timeout
    for (const endpoint of possibleEndpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout

        const backendResponse = await fetch(endpoint, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${API_TOKEN}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (backendResponse.ok) {
          const data = await backendResponse.json();
          // Backend may return an array or an object with users
          allUsers = Array.isArray(data) ? data : (data.users || data.data || []);
          console.log(`Endpoint success: ${endpoint}, Users fetched: ${allUsers.length}`);
          break;
        } else {
          const errorText = await backendResponse.text().catch(() => '');
          console.log(`Endpoint ${endpoint} failed with status ${backendResponse.status}: ${errorText}`);
          if (backendResponse.status !== 404) {
            backendError = new Error(`Backend returned status ${backendResponse.status}: ${errorText}`);
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log(`Timeout trying endpoint ${endpoint}`);
          backendError = new Error("Timeout connecting to backend");
        } else {
          console.log(`Error trying endpoint ${endpoint}:`, error.message);
          backendError = error instanceof Error ? error : new Error(String(error));
        }
        continue;
      }
    }

    if (allUsers.length === 0 && backendError) {
      throw new Error(`Could not get users from backend: ${backendError.message}`);
    }

    // Apply pagination on the frontend
    const totalUsers = allUsers.length;
    const paginatedUsers = allUsers.slice(skip, skip + limit);

    // Transform backend users to frontend format
    const users = paginatedUsers.map((user: any) => ({
      id: user.id || "",
      name: user.nombre || user.name || null,
      email: user.mail || user.email || "",
      emailVerified: (user.activo || user.active || user.emailVerified) ? new Date().toISOString() : null,
      account_email_verified: user.activo || user.active || false,
      createdAt: user.creacion 
        ? new Date(parseInt(user.creacion) * 1000).toISOString()
        : (user.createdAt || user.created_at || new Date().toISOString()),
      updatedAt: user.updatedAt || user.updated_at || new Date().toISOString(),
      _count: {
        accounts: 0,
        sessions: 0,
      },
    }));

    console.log(`Total users in DB: ${totalUsers}, Users fetched: ${users.length}, Page: ${page}, Limit: ${limit}`);

    return NextResponse.json({
      users,
      pagination: {
        total: totalUsers,
        page,
        limit,
        totalPages: Math.ceil(totalUsers / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Error fetching users", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// DELETE - Delete user from backend
export async function DELETE(request: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("id");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID required" },
        { status: 400 }
      );
    }

    // Call backend to delete user
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout

    try {
      const backendResponse = await fetch(`${HOST}users/${userId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!backendResponse.ok) {
        const errorText = await backendResponse.text().catch(() => '');
        throw new Error(`Backend returned status ${backendResponse.status}: ${errorText}`);
      }

      return NextResponse.json({ success: true });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error("Timeout connecting to backend");
      }
      throw fetchError;
    }
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Error deleting user", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

