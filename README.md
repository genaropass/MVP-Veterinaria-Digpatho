# DigpathoVet - MVP de Citología Veterinaria

MVP de DigpathoVet: Plataforma de citología veterinaria de precisión. Integra un motor de reglas médicas y visión artificial (Cellpose/OpenCV) para evaluar calidad de muestra, detectar morfologías anormales (Anisocariosis) y predecir patologías mediante frotis sanguíneos.

## Instrucciones para correr el proyecto localmente

Este proyecto se divide en dos partes: el **Frontend** (Next.js) y el **Backend** (FastAPI en Python). Debes ejecutar ambos simultáneamente en terminales separadas.

### 1. Iniciar el Backend (Python IA)
Requisitos: Python 3.10+ instalado.

```bash
cd backend
# Crear un entorno virtual si no existe
python -m venv venv
# Activar el entorno virtual (En Windows)
.\venv\Scripts\Activate.ps1
# (En Mac/Linux usa: source venv/bin/activate)

# Instalar dependencias
pip install fastapi uvicorn python-multipart pillow numpy slowapi cellpose opencv-python-headless

# Levantar el servidor
uvicorn app.main:app --reload
```
*El backend quedará corriendo en `http://localhost:8000`.*

### 2. Iniciar el Frontend (Next.js)
Requisitos: Node.js 18+ instalado.

```bash
cd frontend
# Instalar paquetes (solo la primera vez)
npm install
# Iniciar el servidor de desarrollo
npm run dev
```
*El frontend quedará corriendo en `http://localhost:3000`.*

---

## Roadmap y Resumen Técnico (Walkthrough)

Hemos establecido exitosamente los cimientos del nuevo MVP para Digpatho Veterinaria.

### 1. Estructura de Directorios Independiente
Se creó la carpeta principal aislando por completo este nuevo producto de arquitecturas antiguas.

### 2. Frontend Moderno (Next.js)
- **Metadatos y Branding**: "Digpatho Veterinaria | Diagnóstico IA".
- **Dashboard Interactivo**: UI funcional en `src/app/(private)/dashboard/page.tsx`. Esta interfaz cuenta con:
  - Formulario de "Datos del Paciente" (Especie, Raza, Edad, Sexo).
  - Zona de arrastre y subida (Drag & Drop) para las imágenes de citología.
- **Lógica Médica**: Extrajimos los diccionarios clínicos (`valores_referencia.json`, `alteraciones.json`) y el motor algorítmico.

### 3. Backend de Inferencia (Python/FastAPI)
- **Limpieza**: API ligera y lista para escalar.
- **API Lista para IA**: Endpoint maestro `POST /api/v1/analyze-smear`.

### Fase 1 Completada: Motor Clínico Real y Modelo Híbrido

Se ha implementado el **Modelo Híbrido** en el Dashboard, dividiendo la experiencia en dos pestañas:

1. **Ingreso Clínico Manual:** El veterinario puede cargar los valores del hemograma manualmente. El sistema utiliza el motor clínico para cruzar estos datos con la especie, raza y edad del paciente, generando **alertas clínicas reales y funcionales** en tiempo real.
2. **Análisis Visual IA:** Preparado para recibir la imagen de la muestra y procesarla automáticamente.

**Justificación Estratégica del Modelo Híbrido:**
- **MVP Usable desde el Día 1:** Permite a los veterinarios usar la aplicación como asistente diagnóstico inmediato, aportando valor clínico real antes de que el entrenamiento de la IA finalice.
- **Validación Profesional:** Facilita a expertos veterinarios probar casos reales e interactuar con el motor de reglas médicas, ganando confianza en el sistema subyacente.
- **Fallback de Seguridad (Degradación Elegante):** Cuando la IA rechace una imagen por mala calidad (desenfoque, mala tinción), el sistema guiará al usuario a cargar los datos manualmente, evitando una experiencia frustrante.

### Fase 2 Completada: Cellpose + Filtro de Calidad

1. **Filtro de Calidad (Modelo I):** El backend evalúa instantáneamente si la imagen subida sirve para análisis mediante técnicas de visión clásica (nitidez vía Laplaciano, sobreexposición, y tintura mediante HSV). Esto evita gastar recursos de IA en imágenes borrosas.
2. **Segmentación Cellpose:** Integramos el modelo *cyto3* de Cellpose en el backend. Cuando subes una foto, segmenta las células y envía los *bounding boxes* al frontend.
3. **Canvas Interactivo:** Componente `SmearCanvas.tsx` que superpone de forma inteligente los bounding boxes directamente sobre tu imagen original en la pestaña de Análisis Visual.

### Mejoras Adicionales Previas a Fase 3

1. **Morfometría Celular Computacional:** Utilizando OpenCV sobre las máscaras de Cellpose, el backend ahora calcula el área y la circularidad geométrica de cada célula detectada. Esto permite:
   - Detectar varianza de tamaño nuclear (Anisocariosis) de forma automática.
   - Detectar células pleomórficas o con proyecciones irregulares (como en el Linfoma TZL).
   - Generar un "Heatmap" proxy visual (las cajas se pintan de rojo/naranja si la célula es matemáticamente muy irregular, y verde si es normal).
2. **Landing Page Comercial:** Se creó la primera versión de la página pública de inicio (`/`) de DigpathoVet, destacando el valor del "Filtro Pre-analítico" y la "Morfometría". Esto sirve inmediatamente como herramienta de ventas (fase de atracción del embudo comercial).

### ¿Qué sigue?
La **Fase 3: Detección de Hemoparásitos**. Esta es la última milla y **depende exclusivamente de los datasets**. Una vez que contemos con las imágenes etiquetadas, entrenaremos YOLOv8 para identificar Leishmania, Babesia, etc.
