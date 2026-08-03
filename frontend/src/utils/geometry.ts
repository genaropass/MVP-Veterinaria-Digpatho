// src/utils/geometry.ts

export interface Point {
  x: number;
  y: number;
}

// CORRECCIÓN: Ahora usamos 'label' para que coincida con tu tipo 'Coordinate'
export interface CellPoint {
  x: number;
  y: number;
  label: string; 
  [key: string]: any; // Esto permite que pase cualquier otra propiedad extra (id, minAxis, etc)
}

/**
 * Algoritmo "Ray Casting" para verificar si un punto está dentro de un polígono.
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Devuelve la lista de células actualizada.
 * Usa Genéricos <T> para asegurar que devuelve EXACTAMENTE el mismo tipo que recibe.
 */
export function getUpdatedCellsInRegion<T extends CellPoint>(
  allCells: T[], 
  selectionPolygon: Point[], 
  action: 'set_positive' | 'set_negative' | 'delete'
): T[] {
  
  // CASO A: Borrar
  if (action === 'delete') {
    return allCells.filter(cell => 
      !isPointInPolygon({x: cell.x, y: cell.y}, selectionPolygon)
    );
  }

  // CASO B: Cambiar Etiqueta
  // Usamos .map para devolver un nuevo array inmutable
  return allCells.map(cell => {
    // Si está fuera del lazo, devolvemos la célula original intacta
    if (!isPointInPolygon({x: cell.x, y: cell.y}, selectionPolygon)) {
      return cell;
    }

    // Si está dentro, actualizamos su LABEL
    if (action === 'set_positive') {
      return { ...cell, label: 'positivo' };
    }
    if (action === 'set_negative') {
      return { ...cell, label: 'negativo' };
    }
    
    return cell;
  });
}
