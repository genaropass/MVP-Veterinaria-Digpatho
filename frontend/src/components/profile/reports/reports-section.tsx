'use-client';

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/context/profile-context";
import { useTranslations } from "next-intl";

interface ReportSectionProps {
  marker: Marker;
}

type Marker = "ki67" | "estrogen" | "progesterone" | "her2";

type Report =
  | { result: string } // solo para ki67
  | {
      positivePercentage: string;
      stainingIntensity: string;
      interpretation: string;
    };

export const ReportSection: React.FC<ReportSectionProps> = ({ marker }) => {
  const { state, updateReportField } = useProfile();
  const t = useTranslations("report");
  const report = state.reports[marker] as Report | undefined;

  if (!report) return null;

  const handleChange = (field: string, value: string) => {
    updateReportField(marker, field, value);
  };

  const isKi67 = marker === "ki67";
  const showIntensity = ["estrogen", "progesterone"].includes(marker);
  const showInterpretation = marker !== "ki67";
  console.log((report as { result: string })?.result)

  return (
    <Card className="bg-white dark:bg-gray-900">
      <CardContent className="p-4">
        <h3 className="font-semibold mb-4">{t(`markers.${marker}`)}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="dark:text-gray-200">{isKi67  ? t("result") : t("positive-cells-percentage")}</Label>
            <Input
                placeholder="N/A"
                value={
                    isKi67
                    ? (report as { result: string })?.result ?? ""
                    : (report as {
                        positivePercentage: string;
                        })?.positivePercentage ?? ""
                }
                onChange={(e) =>
                    handleChange(
                        isKi67 ? "result" : "positivePercentage",
                        e.target.value
                    )
                }
                className="dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          {showIntensity && (
            <div>
              <Label className="dark:text-gray-200">{t("staining-intensity")}</Label>
              <Select
                value={
                  (report as { stainingIntensity: string })?.stainingIntensity ??
                  ""
                }
                onValueChange={(value) => handleChange("stainingIntensity", value)}
              >
                <SelectTrigger className="dark:bg-gray-800 dark:text-gray-100">
                  <SelectValue placeholder="Bajo" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:text-gray-100">
                  <SelectItem value="low">{t("marker-options.low")}</SelectItem>
                  <SelectItem value="medium">{t("marker-options.moderate")}</SelectItem>
                  <SelectItem value="high">{t("marker-options.high")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {showInterpretation && (
            <div>
              <Label className="dark:text-gray-200">{t("interpretation")}</Label>
              <Select
                value={
                  (report as { interpretation: string })?.interpretation ?? ""
                }
                onValueChange={(value) => handleChange("interpretation", value)}
              >
                <SelectTrigger className="dark:bg-gray-800 dark:text-text-gray-100">
                  <SelectValue placeholder="Positivo" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:text-text-gray-100">
                  <SelectItem value="positive">{t("marker-options.positive")}</SelectItem>
                  <SelectItem value="negative">{t("marker-options.negative")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
