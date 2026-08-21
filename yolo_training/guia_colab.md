# Guía Definitiva de Entrenamiento (Babesia + Leishmania)

Esta guía contiene el código exacto para descargar tus dos datasets, mezclarlos inteligentemente y entrenar tu primer modelo MVP.

Copiá y pegá estos bloques en las celdas de un nuevo notebook de [Google Colab](https://colab.research.google.com/). Asegurate de ir a `Entorno de ejecución > Cambiar tipo de entorno de ejecución` y seleccionar **T4 GPU**.

### Celda 1: Preparar entorno y conectar Drive
```python
from google.colab import drive
import os

drive.mount('/content/drive')
PROJECT_DIR = '/content/drive/MyDrive/DigpathoVet_YOLO'
os.makedirs(PROJECT_DIR, exist_ok=True)
%cd {PROJECT_DIR}

!pip install ultralytics roboflow
```

### Celda 2: Descargar y Fusionar Datasets
Este script descarga ambos proyectos y los une. A Babesia le asigna la clase `0` y a Leishmania la clase `1`.
```python
import os
import shutil
import yaml
from pathlib import Path
from roboflow import Roboflow

rf = Roboflow(api_key="V4xnU5aEgmSUSUsJ0Dhs")

print("Descargando Babesia...")
ds_babesia = rf.workspace("genaro-passera").project("hemoparasitos-mvp").version(2).download("yolov11")

print("Descargando Leishmania...")
ds_leish = rf.workspace("genaro-passera").project("leishmania-project-l94eb").version(1).download("yolov11")

combined_dir = Path("/content/dataset_final")
for split in ["train", "valid", "test"]:
    os.makedirs(combined_dir / split / "images", exist_ok=True)
    os.makedirs(combined_dir / split / "labels", exist_ok=True)

def merge_dataset(source_path, split, target_class_id):
    src_img = Path(source_path) / split / "images"
    src_lbl = Path(source_path) / split / "labels"
    if not src_img.exists(): return
    
    for img_file in src_img.glob("*.*"):
        shutil.copy(img_file, combined_dir / split / "images" / img_file.name)
        lbl_file = src_lbl / (img_file.stem + ".txt")
        if lbl_file.exists():
            with open(lbl_file, "r") as f:
                lines = f.readlines()
            new_lines = []
            for line in lines:
                parts = line.strip().split()
                if len(parts) > 0:
                    parts[0] = str(target_class_id) # Forzamos la clase correcta
                    new_lines.append(" ".join(parts) + "\n")
            with open(combined_dir / split / "labels" / lbl_file.name, "w") as f:
                f.writelines(new_lines)

print("Fusionando...")
# Babesia será la clase 0
for s in ["train", "valid", "test"]: merge_dataset(ds_babesia.location, s, 0)
# Leishmania será la clase 1
for s in ["train", "valid", "test"]: merge_dataset(ds_leish.location, s, 1)

yaml_content = {
    "train": str(combined_dir / "train" / "images"),
    "val": str(combined_dir / "valid" / "images"),
    "nc": 2,
    "names": ["Babesia", "Leishmania"]
}
with open(combined_dir / "data.yaml", "w") as f:
    yaml.dump(yaml_content, f)
    
print("¡Datasets unidos perfectamente!")
```

### Celda 3: Entrenar el Modelo
```python
from ultralytics import YOLO

# Cargamos el modelo base v11 (el más moderno y rápido)
model = YOLO('yolo11n.pt')

print("Iniciando entrenamiento...")
results = model.train(
    data="/content/dataset_final/data.yaml",
    epochs=50,             # 50 pasadas de entrenamiento
    imgsz=640,             
    batch=16,              
    name='modelo_mvp_v1' 
)
```

### Celda 4: Exportar el Cerebro
```python
# Guardamos el mejor modelo en tu Google Drive para que no se pierda
!cp runs/detect/modelo_mvp_v1/weights/best.pt /content/drive/MyDrive/DigpathoVet_YOLO/best_hemoparasitos.pt
print("¡ENTRENAMIENTO TERMINADO! Tu modelo está en tu Google Drive como 'best_hemoparasitos.pt'")
```
