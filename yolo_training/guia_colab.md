# Guía de Entrenamiento de YOLOv8 en Google Colab

Copiá y pegá estos bloques de código en las celdas de un nuevo notebook de [Google Colab](https://colab.research.google.com/).

## Paso 1: Configurar la GPU y montar Google Drive
Asegurate de ir a `Entorno de ejecución > Cambiar tipo de entorno de ejecución` y seleccionar **T4 GPU**.

```python
# Celda 1
from google.colab import drive
import os

# Montar Google Drive para guardar el modelo final
drive.mount('/content/drive')

# Crear carpeta para el proyecto en tu Drive
PROJECT_DIR = '/content/drive/MyDrive/DigpathoVet_YOLO'
os.makedirs(PROJECT_DIR, exist_ok=True)
%cd {PROJECT_DIR}
```

## Paso 2: Instalar Ultralytics (YOLOv8)
```python
# Celda 2
!pip install ultralytics roboflow
import ultralytics
ultralytics.checks()
```

## Paso 3: Descargar el Dataset
Si subís las imágenes formateadas a Roboflow, te dan un código exacto como este para descargar. Reemplazá el bloque por tu código de Roboflow.
```python
# Celda 3
from roboflow import Roboflow

# NOTA: Reemplazar con tu API Key real y el nombre de tu proyecto cuando lo armes en Roboflow
rf = Roboflow(api_key="TU_API_KEY_ACA")
project = rf.workspace("digpatho").project("hemoparasitos-vet")
version = project.version(1)
dataset = version.download("yolov8")

# Verificamos dónde se guardó
print(f"Dataset guardado en: {dataset.location}")
```

## Paso 4: Entrenar el Modelo
```python
# Celda 4
from ultralytics import YOLO

# Cargar el modelo base nano (el más rápido y liviano)
model = YOLO('yolov8n.pt')

# Entrenar el modelo
# data= apunta al data.yaml que descargó roboflow
results = model.train(
    data=f"{dataset.location}/data.yaml",
    epochs=100,             # Número de pasadas completas por el dataset
    imgsz=640,              # Tamaño de imagen (640x640 es estándar)
    batch=16,               # Cuántas imágenes procesa a la vez
    name='hemoparasitos_v1' # Nombre de esta corrida
)
```

## Paso 5: Validar y Exportar
```python
# Celda 5
# Validar el modelo para ver precisión (mAP)
metrics = model.val()
print(f"Precisión mAP50: {metrics.box.map50}")

# El mejor modelo se guardó automáticamente en runs/detect/hemoparasitos_v1/weights/best.pt
# Lo copiamos a la raíz de tu Google Drive para que te lo descargues fácil
!cp runs/detect/hemoparasitos_v1/weights/best.pt /content/drive/MyDrive/best_hemoparasitos.pt
print("¡Modelo guardado en tu Drive como 'best_hemoparasitos.pt'!")
```
