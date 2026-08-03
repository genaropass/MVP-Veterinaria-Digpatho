'use client';

import { useTranslations } from 'next-intl';// Adjust import path as needed
import {ThemeToggle} from '@/components/theme-toggle'; // Adjust import path as needed

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function SettingsContent({ session }: { session: any }) {
  const t = useTranslations("settings");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">{t('text')}</p>
        </div>

        {/* Main Settings Container */}
        <div className="space-y-6">
          {/* Profile Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('profile')}</h2>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-lg">
                      {session?.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {session?.user?.name || t('default-name')}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      {session?.user?.email || 'user@example.com'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Appearance Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('appearance')}</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{t('theme')}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('choose-color-scheme')}
                    </p>
                  </div>
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
