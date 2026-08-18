import cv2
import numpy as np

def check_image_quality(img_array: np.ndarray) -> dict:
    """
    Evalúa la calidad de una imagen de citología usando visión clásica.
    Devuelve un diccionario con el estado y el motivo si falla.
    """
    if len(img_array.shape) != 3 or img_array.shape[2] != 3:
        return {"calidad": "rechazada", "motivo": "La imagen debe ser RGB."}

    # Convertir a escala de grises para exposición y nitidez
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    
    # 1. Nitidez (Varianza del Laplaciano)
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    # Umbral arbitrario para frotis (dependerá de la cámara, empezamos con 100)
    if laplacian_var < 50:
        return {
            "calidad": "rechazada", 
            "motivo": f"Imagen demasiado borrosa (Nitidez: {laplacian_var:.1f}). Ajuste el foco del microscopio."
        }
        
    # 2. Exposición (Saturación de píxeles)
    # Porcentaje de píxeles casi blancos (>240) o casi negros (<15)
    total_pixels = gray.size
    overexposed = np.sum(gray > 240) / total_pixels
    underexposed = np.sum(gray < 15) / total_pixels
    
    if overexposed > 0.4:
        return {"calidad": "rechazada", "motivo": "Imagen sobreexpuesta (demasiado brillante). Reduzca la luz del microscopio."}
    if underexposed > 0.4:
        return {"calidad": "rechazada", "motivo": "Imagen subexpuesta (demasiado oscura). Aumente la luz del microscopio."}
        
    # 3. Tinción (Presencia de color violeta/azul típico de Wright-Giemsa)
    hsv = cv2.cvtColor(img_array, cv2.COLOR_RGB2HSV)
    # Rango de color azul/violeta/rosa en HSV
    lower_stain = np.array([120, 20, 20])
    upper_stain = np.array([170, 255, 255])
    stain_mask = cv2.inRange(hsv, lower_stain, upper_stain)
    stain_ratio = cv2.countNonZero(stain_mask) / total_pixels
    
    if stain_ratio < 0.01:
        return {"calidad": "rechazada", "motivo": "Tinción insuficiente o ausente. No se detectan colores característicos."}
        
    return {
        "calidad": "aceptable",
        "motivo": "OK",
        "score_nitidez": float(laplacian_var)
    }
