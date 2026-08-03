import ForgotPassword from "./forgot-password";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const Page = async ({ searchParams }: PageProps) => {
  const params = await searchParams;
  const error = params?.error;
  const errorMessage =
    error === "InvalidCredentials" ? "Credenciales inválidas" : null;

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-center mb-6 text-foreground">
        Forgot your password?
      </h1>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-background px-2 text-muted-foreground">
            Enter your email address to recover your password.
          </span>
        </div>
      </div>

      <ForgotPassword />
      {errorMessage && (
        <p className="text-destructive text-sm mt-2">{errorMessage}</p>
      )}
    </div>
  );
};

export default Page;
