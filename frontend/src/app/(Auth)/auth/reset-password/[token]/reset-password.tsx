"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { resetPassword } from "@/services/usersService";
import { useTranslations } from "next-intl";

function ResetPassword({token}: {token: string}) {
  const t = useTranslations("reset-password");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  console.log("Token recibido:", token);


  useEffect(() => {
    if (!token) {
      router.push("/auth/forgot-password");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const pass = formData.get("password")?.toString();
    const confirm_pass = formData.get("confirm-password")?.toString();

    if (!token) {
      setError(t("error-invalid-token"));
      return;
    }

    if (!pass || !confirm_pass) {
      setError(t("error-missing-data"));
      setIsLoading(false);
      return;
    }

    if (pass != confirm_pass) {
      setError(t("error-mismatch"));
      setIsLoading(false);
      return;
    }

    try {
      await resetPassword(token as string, pass);
      setMsg(t("success-msg"))
      router.push("/auth/sign-in");
    } catch (err) {
      setError(t("error-reset"));
    } finally {
      setIsLoading(false);
    }

    setIsLoading(false);
  };

  return (
    <>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          name="password"
          placeholder={t("password")}
          type="password"
          required
          autoComplete="new-password"
          minLength={6}
          className="bg-background border-border text-foreground placeholder:text-muted-foreground"
        />
        <Input
          name="confirm-password"
          placeholder={t("confirm-password")}
          type="password"
          required
          autoComplete="confirm-password"
          minLength={6}
          className="bg-background border-border text-foreground placeholder:text-muted-foreground"
        />
        <Button
          className="w-full btn bg-primary text-primary-foreground hover:bg-primary/90"
          type="submit"
        >
          {isLoading ? t("button-loading") : t("button")}
        </Button>

        {error && <p className="text-destructive text-sm mt-2">{error}</p>}
        {msg && <p className="text-success text-sm mt-2">{msg}</p>}
      </form>

      <div className="text-center">
        <Button
          asChild
          variant="link"
          className="text-muted-foreground hover:text-foreground"
        >
        </Button>
      </div>
    </>
  );
}

export default ResetPassword;