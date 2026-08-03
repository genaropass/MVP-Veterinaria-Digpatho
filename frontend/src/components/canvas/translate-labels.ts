import type { Coordinate } from "./types";

type Label = Coordinate["label"];

export const getLabelNames = (t: (key: string) => string): Record<Label, string> => ({
  positivo: t("annotation-type-options.positive"),
  negativo: t("annotation-type-options.negative"),
  tejido_no_tumoral: t("annotation-type-options.equivocal"),
  "tincion_alta": t("annotation-type-options.high-staining"),
  "tincion_moderada": t("annotation-type-options.moderate-staining"),
  "no_tincion": t("annotation-type-options.no-staining"),
});