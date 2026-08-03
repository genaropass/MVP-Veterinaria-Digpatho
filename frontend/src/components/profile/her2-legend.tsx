"use client";

import { useTranslations } from "next-intl";

export default function HER2Legend() {
  const t = useTranslations("her2Legend");
  const classifications = [
    { nameKey: "no-staining", descKey: "no-staining-desc", color: "#0000FF" },
    { nameKey: "low-incomplete", descKey: "low-incomplete-desc", color: "#FFFF00" },
    { nameKey: "moderate-complete", descKey: "moderate-complete-desc", color: "#FFA500" },
    { nameKey: "intense-complete", descKey: "intense-complete-desc", color: "#FF0000" },
  ];
  
  return (
    <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="w-full mb-2">
        <h4 className="font-semibold text-sm text-gray-700">{t("title")}</h4>
      </div>
      {classifications.map((item) => (
        <div key={item.nameKey} className="flex items-center gap-2">
          <div 
            className="w-5 h-5 rounded-full border-2 border-gray-800 flex-shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <div className="flex flex-col">
            <strong className="text-sm">{t(item.nameKey)}</strong>
            <small className="text-xs text-gray-600">{t(item.descKey)}</small>
          </div>
        </div>
      ))}
    </div>
  );
}
