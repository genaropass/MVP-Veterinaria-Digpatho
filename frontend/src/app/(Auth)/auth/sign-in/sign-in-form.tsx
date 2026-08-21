"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "next-auth/react";
import Link from "next/link";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

function SignInForm() {
  const t = useTranslations("sign-in");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email");
    const password = formData.get("password");

    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    console.log("res signin: ", res)

    if (res?.error) {
      console.log("res error: ", res.error)
      if (res.error === "CredentialsSignin") {
        console.log("res error: ", res.error)
        setError(t("error"));
      } else {
        setError(res.error || t("error"));
      }
    } else {
      console.log("res error: ")
      router.push("/dashboard");
    }

    setIsLoading(false);
  };

  return (
    <>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          name="email"
          placeholder={t("email")}
          type="email"
          required
          autoComplete="email"
          className="bg-background border-border text-foreground placeholder:text-muted-foreground"
        />
        <Input
          name="password"
          placeholder={t("password")}
          type="password"
          required
          autoComplete="current-password"
          className="bg-background border-border text-foreground placeholder:text-muted-foreground"
        />
        <Button
          className="w-full btn bg-primary text-primary-foreground hover:bg-primary/90"
          type="submit"
          disabled={isLoading}
        >
          {t("button")}
        </Button>

        {error && <p className="text-destructive text-sm mt-2">{error}</p>}
      </form>

      <div className="text-center">
        <Button
          asChild
          variant="link"
          className="text-muted-foreground hover:text-foreground"
        >
          <Link href="/auth/sign-up">{t("sign-up-link")}</Link>
        </Button>
        <Button
          asChild
          variant="link"
          className="text-muted-foreground hover:text-foreground"
        >
          <Link href="/auth/forgot-password">{t("forgot-password-link")}</Link>
        </Button>
      </div>
    </>
  );
}

export default SignInForm;
