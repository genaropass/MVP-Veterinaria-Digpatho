"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { signUpAction } from "@/lib/actions";
import { useRouter } from "next/navigation";

type SignUpState = {
  success: boolean;
  message: string;
  email?: string;
};

function SignUpForm() {
  const router = useRouter();
  const [state, action, isLoading] = useActionState<SignUpState, FormData>(signUpAction, {
    success: false,
    message: "",
  });

  const t = useTranslations("sign-up");

  useEffect(() => {
    if (state.success && state.message && state.email) {
      localStorage.setItem("userEmail", state.email);
      router.push("/auth/validate-email");
    }
  }, [state, router]);

  return (
    <form className="space-y-4" action={action}>
      <Input
        name="name"
        placeholder={t("name")}
        type="text"
        required
        autoComplete="name"
        className="bg-background border-border text-foreground placeholder:text-muted-foreground"
      />
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
        autoComplete="new-password"
        minLength={6}
        className="bg-background border-border text-foreground placeholder:text-muted-foreground"
      />
      <Button
        className="w-full btn bg-primary text-primary-foreground hover:bg-primary/90"
        type="submit"
      >
        {isLoading ? t("button") : t("button")}
      </Button>

      {!state.success && state.message && (
        <p className="text-destructive text-sm">{state.message}</p>
      )}
      {state.success && state.message && (
        <p className="text-success text-sm">{state.message}</p>
      )}
    </form>
  );
}

export default SignUpForm;
