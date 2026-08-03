'use-client';

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="bg-gradient-to-t from-white to-gray-100 text-gray-800 py-16 border-t-4 border-purple-500 shadow-lg">
      <div className="site-container text-center">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="flex flex-col items-center hover:scale-105 transition duration-300">
            <h3 className="text-2xl font-bold text-purple-600">
              <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent inline-block">
                {t("subtitle-1")}
              </span>
            </h3>
            <p className="text-base mt-2 max-w-sm text-gray-600">{t("textp")}</p>
          </div>

          <div className="flex flex-col items-center hover:scale-105 transition duration-300">
            <h3 className="text-2xl font-bold text-purple-600">
              <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent inline-block">
                {t("subtitle-2")}
              </span>
            </h3>
            <ul className="text-base space-y-3 mt-2">
              <li>
                <Link href="/investigation" className="lg:hover:opacity-80 transition duration-300 text-gray-700">
                  {t("li-1")}
                </Link>
              </li>
              <li>
                <Link href="/prostate-cancer" className="lg:hover:opacity-80 transition duration-300 text-gray-700">
                  {t("li-2")}
                </Link>
              </li>
              <li>
                <Link href="/breast-cancer" className="lg:hover:opacity-80 transition duration-300 text-gray-700">
                  {t("li-3")}
                </Link>
              </li>
              <li>
                <Link href="/articles" className="lg:hover:opacity-80 transition duration-300 text-gray-700">
                  {t("li-4")}
                </Link>
              </li>
            </ul>
          </div>

          <div className="flex flex-col items-center hover:scale-105 transition duration-300">
            <h3 className="text-2xl font-bold text-purple-600">
              <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent inline-block">
                {t("subtitle-3")}
              </span>
            </h3>
            <p className="text-base mt-2 text-gray-600">{t("phone-number")}</p>
            <Link
              href="mailto:contact@digpatho.com?subject=Solicitud%20de%20Contacto&body"
              className="lg:hover:opacity-80"
            >
              <p className="text-base mb-4 text-gray-700">{t("email")}</p>
            </Link>
            <div className="flex space-x-6 mt-4">
              <Link href="https://www.instagram.com/digpathoai/" aria-label="Instagram" className="lg:hover:opacity-80 transition duration-300">
                <Image src="/assets/icons/instagram.svg" alt="Instagram" width={35} height={35} className="filter grayscale hover:filter-none transition duration-300" />
              </Link>
              <Link href="https://www.facebook.com/profile.php?id=61566270608399" aria-label="Facebook" className="lg:hover:opacity-80 transition duration-300">
                <Image src="/assets/icons/facebook.svg" alt="Facebook" width={35} height={35} className="filter grayscale hover:filter-none transition duration-300" />
              </Link>
              <Link href="https://www.linkedin.com/company/digital-pathology-lab/" aria-label="LinkedIn" className="lg:hover:opacity-80 transition duration-300">
                <Image src="/assets/icons/linkedin.svg" alt="LinkedIn" width={35} height={35} className="filter grayscale hover:filter-none transition duration-300" />
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-300 mt-12 pt-8 text-center text-sm text-gray-600">
          <div className="flex flex-col md:flex-row justify-center items-center space-y-4 md:space-y-0 md:space-x-8">
            <Link href="/" aria-label="Home" className="lg:hover:scale-110 transition duration-300">
              <Image src="/assets/logo.png" alt="DigPatho Logo" className="cursor-pointer" priority height={150} width={150} />
            </Link>

            <p className="text-lg md:text-xl lg:text-2xl font-bold text-gray-800">
              <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent inline-block">
                {t("textp-2")}
              </span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}