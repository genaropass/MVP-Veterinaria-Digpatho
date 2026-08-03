"use client";

import { Button } from "@/components/ui/button";
import { AnalysisResult } from "@/context/profile-context";
import { Activity, CheckCircle2, Bot } from "lucide-react";
import { useTranslations } from "next-intl";

interface AnalysisFieldSummaryProps {
  result: AnalysisResult | null;
  isAnalyzed: boolean;
}

export default function AnalysisFieldsSummary({ result, isAnalyzed }: AnalysisFieldSummaryProps) {
  const t = useTranslations("studyTab");
  const percentageVal = parseFloat(result?.percentage?.replace("%", "") || "0");
  const isHigh = percentageVal > 14;

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" />
            {t("ki67-title")}
          </h3>
          <div className="mt-2 flex items-baseline gap-3">
            <span className={`text-5xl font-bold ${isHigh ? 'text-red-600' : 'text-blue-600'}`}>
              {result?.percentage || "0%"}
            </span>
            <span className="text-sm text-gray-400 font-medium">{t("validated-by-pathologist")}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="p-4 text-center">
            <div className="flex justify-center mb-1">
              <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
            </div>
            <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{result?.positiveCells || "0"}</div>
            <div className="text-xs font-medium text-red-600 uppercase tracking-tight">{t("positive")}</div>
          </div>

          <div className="p-4 text-center">
            <div className="flex justify-center mb-1">
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
            </div>
            <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{result?.negativeCells || "0"}</div>
            <div className="text-xs font-medium text-green-600 uppercase tracking-tight">{t("negative")}</div>
          </div>

          <div className="p-4 text-center">
             <div className="flex justify-center mb-1">
              <div className="w-2 h-2 rounded-full bg-gray-400"></div>
            </div>
            <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{result?.totalCells || "0"}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-tight">{t("total")}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
        <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-gray-400 uppercase">
          <Bot className="w-3 h-3" />
          {t("ia-reference")}
        </div>
        
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <span className="block text-xs text-gray-400">{t("ia-index")}</span>
            <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                {result?.iaPercentage || "-"}
            </span>
          </div>
          <div>
            <span className="block text-xs text-gray-400">{t("positive")}</span>
            <span className="font-mono text-gray-600 dark:text-gray-400">{result?.iaPositiveCells || "-"}</span>
          </div>
          <div>
            <span className="block text-xs text-gray-400">{t("negative")}</span>
            <span className="font-mono text-gray-600 dark:text-gray-400">{result?.iaNegativeCells || "-"}</span>
          </div>
          <div>
            <span className="block text-xs text-gray-400">{t("total")}</span>
            <span className="font-mono text-gray-600 dark:text-gray-400">{result?.iaTotalCells || "-"}</span>
          </div>
        </div>
      </div>

      <div className="pt-2">
        <Button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg shadow-blue-900/10 transition-all h-12 text-base"
          disabled={!isAnalyzed}
        >
          <CheckCircle2 className="w-5 h-5 mr-2" />
          {t("confirm-save-annotation")}
        </Button>
        <p className="text-center text-xs text-gray-400 mt-3">
          {t("confirm-save-hint")}
        </p>
      </div>
    </div>
  );
}
