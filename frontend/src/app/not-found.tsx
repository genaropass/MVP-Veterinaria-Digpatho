'use-client';

import { useTranslations } from "next-intl";

import Link from "next/link";

export default function NotFound() {

  const t = useTranslations('notFound');

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background text-center">
      <h1 className="text-9xl font-bold text-primary animate-bounce">404</h1>
      <p className="mt-4 text-2xl font-semibold text-secondary">
        {t("title")}
      </p>
      <p className="mt-2 text-gray-500">{t("description")}.</p>

      <div className="relative mt-8 flex items-center justify-center">

        <Link
          href="/"
          className="relative z-10 rounded-lg bg-primary px-6 py-3 text-white shadow-lg transition-all hover:scale-105 hover:bg-primary-dark"
        >
          {t("button")}
        </Link>
      </div>
    </div>
  );
}