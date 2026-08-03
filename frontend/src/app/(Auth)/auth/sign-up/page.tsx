import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
// import { GithubSignIn } from "@/components/github-sign-in";
// import { GoogleSignIn } from "@/components/google-sign-in";
import SignUpForm from "./sign-up-form";
import { getCachedSession } from "@/lib/session";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const Page = async ({ searchParams }: PageProps) => {
  const session = await getCachedSession();
  if (session) redirect("/profile");
  const params = await searchParams;
  const error = params?.error;
  const errorMessage =
    error === "InvalidCredentials" ? "Credenciales inválidas" : null;

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-center mb-6 text-foreground">
        Create Account
      </h1>

      {/* <GithubSignIn />
        <GoogleSignIn /> */}

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with email
          </span>
        </div>
      </div>

      <SignUpForm />

      {errorMessage && (
        <p className="text-destructive text-sm mt-2">{errorMessage}</p>
      )}

      <div className="text-center">
        <Button
          asChild
          variant="link"
          className="text-muted-foreground hover:text-foreground"
        >
          <Link href="/auth/sign-in">Already have an account? Sign in</Link>
        </Button>
      </div>
    </div>
  );
};

export default Page;
