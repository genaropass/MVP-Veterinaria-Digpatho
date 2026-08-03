"use client";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { APP_URL } from "@/utils/constants";

const SignOut = () => {
    const t = useTranslations("sidebar");

    const handleSignOut = async () => {
        await signOut({ callbackUrl: "/auth/sign-in", redirect: true });
    };

    return (
        <div className="flex justify-center">
            <Button variant="destructive" onClick={handleSignOut}>
                {t("logout")}
            </Button>
        </div>
    );
};

export { SignOut };