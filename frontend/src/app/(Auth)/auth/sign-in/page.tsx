import { redirect } from "next/navigation";

// import { GithubSignIn } from "@/components/github-sign-in";
// import { GoogleSignIn } from "@/components/google-sign-in";

import SignInForm from "./sign-in-form";
import { getCachedSession } from "@/lib/session";
import { getTranslations } from "next-intl/server";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const Page = async ({ searchParams }: PageProps) => {
  const session = await getCachedSession();
  if (session) redirect("/dashboard");
  const params = await searchParams;
  const error = params?.error;
  const reason = params?.reason;
  const t = await getTranslations("sign-in");
  const errorMessage =
    error === "InvalidCredentials" ? t("error") : null;
  const sessionExpiredMessage =
    reason === "session_expired" ? t("session-expired") : null;

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-center mb-6 text-foreground">
        {t("title")}
      </h1>

      {/* <GithubSignIn />
        <GoogleSignIn /> */}

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-background px-2 text-muted-foreground">
            {t("or-continue-with-email")}
          </span>
        </div>
      </div>

      <SignInForm />
      {sessionExpiredMessage && (
        <p className="text-amber-600 text-sm mt-2 text-center">{sessionExpiredMessage}</p>
      )}
      {errorMessage && (
        <p className="text-destructive text-sm mt-2">{errorMessage}</p>
      )}
    </div>
  );
};

export default Page;
