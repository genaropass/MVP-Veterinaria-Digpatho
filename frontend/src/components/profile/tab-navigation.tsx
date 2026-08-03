"use client"

import { useState } from "react"
import type React from "react"
import { cn } from "@/lib/utils"
import CriteriosDeSubida from "../CancerView/CriteriosDeSubida"
import { useProfile } from "@/context/profile-context"
import { useTranslations } from "next-intl" // <--- 1. IMPORTAR ESTO

// Nota: Ya no necesitamos la propiedad "name" aquí porque la sacaremos del JSON.
// We use "slot" as the key to look up the translation.
const tabs = [
  { slot: "ki67", disabled: false },
  { slot: "estrogen", disabled: false },
  { slot: "progesterone", disabled: false },
  { slot: "her2", disabled: false },
  { slot: "reports", disabled: false },
] as const;

type SlotKey = (typeof tabs)[number]["slot"];

interface TabNavigationProps {
  slots: Record<SlotKey, React.ReactNode>;
}

export default function TabNavigation({ slots }: TabNavigationProps) {
  const [activeTab, setActiveTab] = useState<SlotKey>("ki67")
  const { isAnalyzing } = useProfile()
  
  // 2. INICIALIZAR EL HOOK DE TRADUCCIÓN
  // Esto buscará dentro de tu JSON en: "tab-navigation" -> "tabs"
  const t = useTranslations("tab-navigation.tabs");
  const tGeneral = useTranslations("tab-navigation"); // Para mensajes generales como "coming-soon"

  return (
    <div>
      <div className="border-b border-gray-200 relative flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0">
        <nav className="-mb-px flex flex-wrap justify-center sm:flex-nowrap sm:space-x-8" role="tablist">
          {tabs.map((tab) => {
            const isDisabled = tab.disabled || isAnalyzing;
            return (
              <button 
                key={tab.slot} 
                onClick={() => !isDisabled && setActiveTab(tab.slot)}
                disabled={isDisabled}
                className={cn(
                  "py-2 px-4 text-center text-sm font-medium whitespace-nowrap transition-colors",
                  isDisabled
                    ? "text-gray-300 cursor-not-allowed border-transparent"
                    : activeTab === tab.slot
                    ? "border-b-2 border-primary text-primary"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                )}
                aria-selected={activeTab === tab.slot}
                aria-disabled={isDisabled}
                role="tab"
                // You can also translate tooltips here if needed
                title={tab.disabled ? tGeneral("coming-soon") : isAnalyzing ? "Wait for analysis..." : undefined}
              >
                {/* 3. AQUÍ ESTÁ LA MAGIA: Traducimos usando el slot como clave */}
                {t(tab.slot)}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-4">
        {activeTab !== "reports" && (
            <div className="mb-4">
                <CriteriosDeSubida />
            </div>
        )}

        {slots[activeTab]}
      </div>
    </div>
  );
}
