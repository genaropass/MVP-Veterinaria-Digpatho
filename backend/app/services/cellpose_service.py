import logging
import numpy as np

logger = logging.getLogger(__name__)

try:
    from cellpose import models
    CELLPOSE_AVAILABLE = True
except ImportError:
    CELLPOSE_AVAILABLE = False
    logger.warning("Cellpose no está instalado. Ejecutando en modo simulación/stub.")

# Variable global para cargar el modelo una sola vez
_model = None

def get_cellpose_model():
    global _model
    if not CELLPOSE_AVAILABLE:
        return None
    if _model is None:
        logger.info("Cargando modelo Cellpose (cyto3)...")
        # cyto3 es el modelo recomendado para citología general
        _model = models.Cellpose(gpu=False, model_type='cyto3')
    return _model


import cv2

def segmentar_imagen(img_array: np.ndarray):
    """
    Segmenta la imagen con Cellpose y extrae características morfométricas.
    """
    if not CELLPOSE_AVAILABLE:
        # Simulación
        h, w = img_array.shape[:2]
        return {
            "celulas": [
                {"id": 1, "tipo": "simulada", "bbox": [int(w*0.2), int(h*0.2), int(w*0.3), int(h*0.3)], "color": "green", "irregularity": 0.2},
            ],
            "morph_alerts": []
        }

    model = get_cellpose_model()
    masks, flows, styles, diams = model.eval(img_array, diameter=None, channels=[0, 0])
    
    celulas = []
    areas = []
    
    num_celulas = masks.max()
    for i in range(1, num_celulas + 1):
        cell_mask = (masks == i).astype(np.uint8)
        
        # Encontrar contornos para morfometría
        contours, _ = cv2.findContours(cell_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue
            
        cnt = contours[0]
        area = cv2.contourArea(cnt)
        perimeter = cv2.arcLength(cnt, True)
        
        if area < 10 or perimeter == 0:
            continue
            
        areas.append(area)
        
        # Circularidad (1.0 es un círculo perfecto, menor es más irregular/proyecciones)
        circularity = 4 * np.pi * (area / (perimeter * perimeter))
        irregularity_score = 1.0 - circularity
        
        # Bounding box
        x, y, w, h = cv2.boundingRect(cnt)
        
        # Determinar color basado en irregularidad (Heatmap proxy)
        # Verde = normal, Naranja/Rojo = muy irregular (pleomorfismo)
        if irregularity_score > 0.4:
            color = "red" # Alta sospecha (proyecciones, renacuajo)
        elif irregularity_score > 0.25:
            color = "orange" # Sospechoso
        else:
            color = "green" # Normal
            
        celulas.append({
            "id": i,
            "tipo": "célula",
            "bbox": [x, y, x + w, y + h],
            "color": color,
            "irregularity": round(irregularity_score, 3)
        })
        
    # Alertas morfométricas globales
    morph_alerts = []
    if len(areas) > 10:
        mean_area = np.mean(areas)
        std_area = np.std(areas)
        cv_area = std_area / mean_area
        
        if cv_area > 0.3: # Variación de tamaño > 30%
            morph_alerts.append("Anisocariosis significativa detectada (CV Área > 30%).")
            
        high_irregular = sum(1 for c in celulas if c["irregularity"] > 0.4)
        if high_irregular / len(celulas) > 0.1:
            morph_alerts.append("Alto porcentaje (>10%) de células con proyecciones/pleomorfismo.")

    return {
        "celulas": celulas,
        "morph_alerts": morph_alerts
    }

