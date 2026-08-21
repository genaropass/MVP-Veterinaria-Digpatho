import { redirect } from "next/navigation";

// import { GithubSignIn } from "@/components/github-sign-in";
// import { GoogleSignIn } from "@/components/google-sign-in";

import ValidateEmail from "./validate-email";
import { getCachedSession } from "@/lib/session";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const Page = async ({ searchParams }: PageProps) => {
  const session = await getCachedSession();
  if (session) redirect("/dashboard");
  const params = await searchParams;
  const error = params?.error;
  const errorMessage =
    error === "InvalidCredentials" ? "Credenciales inválidas" : null;

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-center mb-6 text-foreground">
        Confirm your account
      </h1>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
        </div>
      </div>

      <ValidateEmail />
      {errorMessage && (
        <p className="text-destructive text-sm mt-2">{errorMessage}</p>
      )}
    </div>
  );
};

export default Page;
