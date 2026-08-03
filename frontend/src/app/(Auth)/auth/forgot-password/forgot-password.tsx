"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import React, { useState } from "react";
import { forgotPassword } from "@/services/usersService";
import { useTranslations } from "next-intl";

function ForgotPassword() {
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const t = useTranslations("forgot-password");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email")?.toString();

    if (!email) {
      setError(t("error"));
      setIsLoading(false);
      return;
    }

    try {
      await forgotPassword(email);
      setMsg(t("msg")); 
    } catch (err) {
      setError(t("error-sending"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          name="email"
          placeholder={t("email")} // Traducción para 'Email'
          type="email"
          required
          autoComplete="email"
          className="bg-background border-border text-foreground placeholder:text-muted-foreground"
        />
        <Button
          className="w-full btn bg-primary text-primary-foreground hover:bg-primary/90"
          type="submit"
        >
          {isLoading ? t("sending-email") : t("button")} {/* Traducción para el texto del botón */}
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

export default ForgotPassword;
