/* eslint-disable react-hooks/exhaustive-deps */
'use-client';

import { useTranslations } from 'next-intl';
import Image from "next/image";
import Link from "next/link";
import { HomeCard } from "@/components/home/home-card";
import Statistics from "@/components/statistics/Statistics";

export default function Home() {
  

  const images = [
    "/assets/home-bg.jpeg",
    "/assets/home-bg-2.jpg",
    "/assets/home-bg-3.jpg",
    "/assets/home-bg-4.jpg",
  ];

  const t = useTranslations('page');

  return (
    <>
      <section className="relative bg-white dark:bg-gray-900 py-12 px-6 md:px-20">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 items-center gap-10 space-y-24">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-purple-700 dark:text-purple-300">
              {t("ai-powered-precision")}
            </h1>
            <p className="mt-4 text-gray-600 dark:text-gray-300">
              {t("ai-description")}
            </p>
            <div className="mt-6 flex items-center space-x-4">
              <Link 
                href="/contact-us"
                className="bg-purple-700 text-white px-6 py-2 rounded-lg text-sm font-medium shadow-md hover:bg-purple-800 dark:bg-purple-600 dark:hover:bg-purple-700"
              >
                {t("button")}
              </Link>
              <a href="#" className="text-purple-700 font-medium flex items-center hover:underline">
                {t("see-demo")} <span className="ml-2">👁️</span>
              </a>
            </div>
          </div>
          <div className="relative flex justify-center">
            <div className="relative w-72 h-72 md:w-80 md:h-80">
              <Image src="/assets/home-bg-2.jpg" alt="Scientist working in lab" width={800} height={500} 
              className="rounded-full border-4 border-white shadow-lg"
              />
              <Image src="/assets/home-bg-3.jpg" alt="Scientist with gloves" width={700} height={400}
                className="absolute top-20 right-6 rounded-full border-4 border-white shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      <Statistics />

      <section className="flex flex-col items-center justify-center min-h-screen space-y-8 bg-white dark:bg-gray-900">
        <div className="text-center w-full px-8 mt-20 mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-indigo-500 to-purple-300 dark:from-purple-300 dark:via-indigo-300 dark:to-purple-600 mb-6 transform transition-all duration-500 hover:scale-105 hover:text-purple-800 dark:hover:text-purple-400">
            {t("solution-title")}
          </h1>
          <h2 className="text-xl md:text-2xl font-medium text-gray-800 mb-6 dark:text-gray-200">
            {t("solution-description")}
          </h2>
        </div>
            {/* Solution section iterable cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                   {[
                     ["accuracy", "accuracy-description"],
                     ["time-management", "time-management-description"],
                     ["human-cost", "human-cost-description"],
                     ["economic-cost", "economic-cost-description"],
                     ["versatility", "versatility-description"],
                     ["evolving", "evolving-description"],
                   ].map(([titleKey, descKey]) => (
                     <HomeCard key={titleKey} title={t(titleKey)} description={t(descKey)} />
                   ))}
          </div>
      </section>
    </>
  );
}