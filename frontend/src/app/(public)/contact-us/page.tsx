"use client";

import { useTranslations } from "next-intl";
import ContactForm from "@/components/contact/contact-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ContactUsPage() {
  const t = useTranslations("contact");

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 py-12 px-6 md:px-20">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-indigo-500 to-purple-300 dark:from-purple-300 dark:via-indigo-300 dark:to-purple-600 mb-4">
            {t("title")}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {t("description")}
          </p>
        </div>

        <Card className="bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl text-center text-gray-900 dark:text-gray-100">
              {t("form-title")}
            </CardTitle>
            <CardDescription className="text-center text-gray-600 dark:text-gray-400">
              {t("form-description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContactForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

