export interface Coordinate {
  x: number;
  y: number;
  // Etiqueta libre proveniente del modelo o de la corrección manual.
  // Para Ki67 se usan típicamente: "positivo", "negativo", "tejido_no_tumoral".
  // Para HER2 se permiten etiquetas más flexibles como:
  // "no tincion", "baja incompleta", "moderada completa", "alta completa", "na", "3+ completa", etc.
  label: string;
  minAxis?: number;
}
