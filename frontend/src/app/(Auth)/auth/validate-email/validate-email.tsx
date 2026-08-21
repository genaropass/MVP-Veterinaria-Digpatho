"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { validate2FACode } from "@/services/usersService";
import { useTranslations } from "next-intl";

function ValidateEmail() {
  const t = useTranslations("validate-email");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const token = formData.get("token")?.toString();
    const email = localStorage.getItem("userEmail");

    if (!email || !token) {
      setError(t("error-missing-data"));
      setIsLoading(false);
      return;
    }

    try {
      await validate2FACode(email, token);
      router.refresh();
      router.push("/auth/sign-in"); 
      //router.push("/dashboard");
    } catch (err) {
      setError(t("error-server"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          name="token"
          placeholder={t("code")}
          type="number"
          required
          autoComplete="verification-code"
          className="bg-background border-border text-foreground placeholder:text-muted-foreground"
        />
        <Button
          className="w-full btn bg-primary text-primary-foreground hover:bg-primary/90"
          type="submit"
        >
          {isLoading ? t("button-loading") : t("button")}
        </Button>

        {error && <p className="text-destructive text-sm mt-2">{error}</p>}
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

export default ValidateEmail;
