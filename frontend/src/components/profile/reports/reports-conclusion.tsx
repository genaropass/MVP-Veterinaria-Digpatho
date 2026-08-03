'use-client';

import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "next-intl";

export const ReportsConclusion = ({ value, onChange }: { value: string; onChange: (val: string) => void }) => {
  const t = useTranslations("report");

  return (
    <Card className="bg-white dark:bg-gray-900">
        <CardContent className="p-4">
          <div className="space-y-4">
            <h3 className="font-semibold dark:text-gray-200">
              {t("conclusion")}
            </h3>
            <Textarea
              id="Conclusion"
              placeholder={t("write-your-conclusion-here")}
              className="min-h-[150px] dark:bg-gray-800 dark:text-gray-100"
              value={value}
              onChange={(e) => {
                onChange(e.target.value as string);
              }}
            />
          </div>
        </CardContent>
      </Card>
  );
};