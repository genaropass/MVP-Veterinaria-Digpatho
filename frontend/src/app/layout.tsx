import { Suspense } from "react";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Geist, Geist_Mono } from "next/font/google";

/* import { Analytics } from "@vercel/analytics/next"; */
import { ThemeProvider } from "../components/providers/theme-provider";

import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import LoadingSpinner from "./loading";

import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { SessionExpiryGuard } from "@/components/auth/session-expiry-guard";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Digpatho Veterinaria | Diagnóstico IA",
  description: "Plataforma de diagnóstico veterinario e interpretación de citologías asistida por Inteligencia Artificial.",
  icons: {
    icon: "./favicon.ico",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await import(`../../messages/${locale}.json`).then(
    (mod) => mod.default
  );

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <Suspense fallback={<LoadingSpinner />}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <SessionProvider refetchInterval={60}>
              <SessionExpiryGuard />
              <NextIntlClientProvider messages={messages}>
                <Navbar />
                <main className="flex-grow">
                  {children}
                  
                 {/*  <Analytics /> */}
                </main>
                <Toaster />
                <Footer />
              </NextIntlClientProvider>
            </SessionProvider>
          </ThemeProvider>
        </Suspense>
      </body>
    </html>
  );
}

