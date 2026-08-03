"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: string | null;
  account_email_verified: boolean | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    accounts: number;
    sessions: number;
  };
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 1,
  });

  // Verificar autenticación al cargar
  useEffect(() => {
    checkAuth();
  }, []);

  // Timeout de seguridad: si después de 6 segundos sigue en null, asumir no autenticado
  useEffect(() => {
    if (isAuthenticated === null) {
      const timeoutId = setTimeout(() => {
        console.warn("Auth check timeout, assuming unauthenticated");
        setIsAuthenticated(false);
      }, 6000);

      return () => clearTimeout(timeoutId);
    }
  }, [isAuthenticated]);

  const checkAuth = async () => {
    try {
      // Agregar timeout para evitar que quede colgado
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos

      const response = await fetch("/api/admin/users?page=1&limit=1", {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      setIsAuthenticated(response.ok);
      if (response.ok) {
        // Solo cargar usuarios si la autenticación fue exitosa
        try {
          await fetchUsers(1);
        } catch (fetchError) {
          console.error("Error al cargar usuarios en checkAuth:", fetchError);
          // No romper la página si falla cargar usuarios
        }
      } else {
        // Si no está autenticado, asegurarse de limpiar el estado
        setIsAuthenticated(false);
      }
    } catch (error: any) {
      console.error("Error en checkAuth:", error);
      // Siempre establecer como no autenticado si hay error
      setIsAuthenticated(false);
      
      // Si es un error de timeout, no mostrar error al usuario
      if (error.name !== 'AbortError') {
        // Solo loggear, no mostrar toast en el check inicial
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Normalizar la contraseña antes de enviar (eliminar espacios)
      const normalizedPassword = password.trim();
      
      if (!normalizedPassword) {
        toast.error("Please enter a password");
        setLoading(false);
        return;
      }
      
      // Timeout más corto solo para autenticación (5 segundos es suficiente para comparar contraseña)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos

      let response: Response;
      try {
        response = await fetch("/api/admin/auth", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password: normalizedPassword }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          toast.error("Request timed out. Please try again.");
          setLoading(false);
          return;
        }
        throw fetchError;
      }

      // Verificar si hay respuesta
      if (!response) {
        toast.error("No response received from server");
        setLoading(false);
        return;
      }

      // Intentar parsear la respuesta
      let responseData: any = {};
      try {
        const text = await response.text();
        if (text) {
          responseData = JSON.parse(text);
        }
      } catch (parseError) {
        console.error("Error al parsear respuesta:", parseError);
        // Continuar aunque no se pueda parsear
      }

      if (response.ok) {
        setIsAuthenticated(true);
        setPassword("");
        toast.success("Authentication successful");
        // Cargar usuarios de forma asíncrona sin bloquear (no usar await)
        // Esto evita que los timeouts de fetchUsers afecten la autenticación
        fetchUsers(1).catch((fetchError) => {
          console.error("Error loading users after login:", fetchError);
          // No mostrar error aquí para no interrumpir el flujo de autenticación
        });
      } else {
        // Mostrar el error específico si está disponible
        const errorMessage = responseData?.error || 
                            responseData?.details || 
                            `Error ${response.status}: ${response.statusText}` ||
                            "Incorrect password";
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error("Error al autenticar:", error);
      const errorMessage = error?.message || "Authentication error. Please check your connection.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth", {
        method: "DELETE",
      });
      setIsAuthenticated(false);
      setUsers([]);
      toast.success("Signed out");
      // Redirigir a la página principal
      router.push("/");
    } catch (error) {
      toast.error("Error signing out");
    }
  };

  const fetchUsers = async (page: number = pagination.page) => {
    setLoadingUsers(true);
    try {
      // Timeout para evitar que quede colgado
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos para cargar usuarios

      let response: Response;
      try {
        response = await fetch(`/api/admin/users?page=${page}&limit=${pagination.limit}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error("Request to load users timed out");
        }
        throw fetchError;
      }

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
        console.log(`Usuarios cargados: ${data.users?.length || 0}, Total: ${data.pagination?.total || 0}`);
      } else if (response.status === 401) {
        setIsAuthenticated(false);
      } else {
        const errorData = await response.json().catch(() => ({}));
        // Solo mostrar error si no es un timeout del servidor (504)
        if (response.status !== 504) {
          toast.error(errorData.error || "Error al cargar usuarios");
        } else {
          console.error("Timeout del servidor al cargar usuarios (504)");
        }
      }
    } catch (error: any) {
      console.error("Error al cargar usuarios:", error);
      // No mostrar toast si es un timeout, solo loggear
      if (!error.message?.includes("timed out") && !error.name?.includes("Abort")) {
        toast.error("Error al cargar usuarios");
      }
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setDeletingUserId(userId);
    try {
      const response = await fetch(`/api/admin/users?id=${userId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Usuario eliminado exitosamente");
        fetchUsers();
      } else {
        toast.error("Error al eliminar usuario");
      }
    } catch (error) {
      toast.error("Error al eliminar usuario");
    } finally {
      setDeletingUserId(null);
    }
  };

  // Mostrar loading mientras verifica autenticación
  if (isAuthenticated === null) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  // Mostrar formulario de login si no está autenticado
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Acceso de Administrador</CardTitle>
            <CardDescription>
              Ingrese la contraseña para acceder al panel de administración
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Contraseña
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    disabled={loading}
                  >
                    {showPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Asegúrese de copiar la contraseña completa sin espacios adicionales
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Verificando..." : "Ingresar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Mostrar panel de administración
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Administration Panel</h1>
          <p className="text-muted-foreground mt-2">
            System user management
          </p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          Sign Out
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User List</CardTitle>
          <CardDescription>
            Total users: {pagination.total} | 
            Showing {users.length} of {pagination.total} | 
            Page {pagination.page} of {pagination.totalPages}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No registered users
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-semibold">Email</th>
                      <th className="text-left p-3 font-semibold">Name</th>
                      <th className="text-left p-3 font-semibold">Email Verified</th>
                      <th className="text-left p-3 font-semibold">Accounts</th>
                      <th className="text-left p-3 font-semibold">Sessions</th>
                      <th className="text-left p-3 font-semibold">Creation Date</th>
                      <th className="text-left p-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-muted/50">
                        <td className="p-3">{user.email}</td>
                        <td className="p-3">{user.name || "—"}</td>
                        <td className="p-3">
                          {user.emailVerified || user.account_email_verified ? (
                            <span className="text-green-600">✓ Verified</span>
                          ) : (
                            <span className="text-muted-foreground">Not verified</span>
                          )}
                        </td>
                        <td className="p-3">{user._count.accounts}</td>
                        <td className="p-3">{user._count.sessions}</td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="p-3">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={deletingUserId === user.id}
                              >
                                {deletingUserId === user.id ? "Deleting..." : "Delete"}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the user{" "}
                                  <strong>{user.email}</strong> and all associated data.
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchUsers(pagination.page - 1)}
                      disabled={pagination.page === 1 || loadingUsers}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-2">
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        let pageNum;
                        if (pagination.totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (pagination.page <= 3) {
                          pageNum = i + 1;
                        } else if (pagination.page >= pagination.totalPages - 2) {
                          pageNum = pagination.totalPages - 4 + i;
                        } else {
                          pageNum = pagination.page - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={pagination.page === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => fetchUsers(pageNum)}
                            disabled={loadingUsers}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchUsers(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages || loadingUsers}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

