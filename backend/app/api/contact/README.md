# Módulo de Contacto / Demo Request

Este módulo permite recibir solicitudes de contacto/demo desde un formulario público sin autenticación.

## Características

- ✅ Endpoint público `/api/contact` (sin autenticación requerida)
- ✅ Recibe nombre, email, mensaje y hasta 5 imágenes
- ✅ Guarda imágenes en filesystem del servidor
- ✅ Guarda metadata en base de datos (Prisma)
- ✅ Envía notificación por email vía SMTP
- ✅ Validaciones de tamaño y tipo de archivo
- ✅ Costo $0 (usa SMTP propio y filesystem)

## Configuración

### Variables de Entorno

Agregar al archivo `.env`:

```bash
# Directorio donde se guardan las imágenes (recomendado para EC2)
UPLOAD_DIR=/var/www/uploads/demo-requests

# Email de notificación (donde recibir las solicitudes)
NOTIFICATION_EMAIL=tu-email@digpatho.com

# SMTP (ya configurado en el proyecto)
MAIL=tu-email@digpatho.com
PASSWORD=tu-password-smtp
```

### Crear Directorio en EC2

```bash
sudo mkdir -p /var/www/uploads/demo-requests
sudo chown -R ec2-user:ec2-user /var/www/uploads
sudo chmod -R 755 /var/www/uploads
```

### Migración de Base de Datos

Ejecutar la migración de Prisma:

```bash
prisma migrate dev --name add_demo_request
```

O en producción:

```bash
prisma migrate deploy
```

## Uso del Endpoint

### POST `/api/contact`

Endpoint público para enviar solicitudes de contacto.

**Parámetros (multipart/form-data):**
- `name` (string, requerido): Nombre del cliente
- `email` (string, requerido): Email del cliente
- `message` (string, opcional): Mensaje/descripción
- `images` (file[], requerido): Hasta 5 imágenes (máx 5MB cada una)

**Respuesta exitosa:**
```json
{
  "message": "Solicitud recibida correctamente",
  "id": "uuid-del-request",
  "status": "success"
}
```

**Errores comunes:**
- `400`: Validación fallida (demasiadas imágenes, archivo inválido, etc.)
- `500`: Error del servidor

### GET `/api/contact` (requiere autenticación)

Lista todas las solicitudes. Opcionalmente filtradas por status:
- `?status=PENDING`
- `?status=PROCESSED`
- `?status=DONE`

### GET `/api/contact/{request_id}` (requiere autenticación)

Obtiene una solicitud específica por ID.

## Ejemplo de Uso desde Frontend

### HTML/JavaScript

```html
<!DOCTYPE html>
<html>
<head>
    <title>Contact Form</title>
</head>
<body>
    <form id="contactForm">
        <input type="text" name="name" placeholder="Nombre" required>
        <input type="email" name="email" placeholder="Email" required>
        <textarea name="message" placeholder="Mensaje"></textarea>
        <input type="file" name="images" accept="image/*" multiple required>
        <button type="submit">Enviar</button>
    </form>

    <script>
        document.getElementById('contactForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            
            try {
                const response = await fetch('https://tu-dominio.com/api/contact', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    alert('Solicitud enviada correctamente!');
                    e.target.reset();
                } else {
                    alert('Error: ' + result.detail);
                }
            } catch (error) {
                alert('Error al enviar: ' + error.message);
            }
        });
    </script>
</body>
</html>
```

### React/Next.js

```tsx
import { useState } from 'react';

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
    images: null as FileList | null
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = new FormData();
    data.append('name', formData.name);
    data.append('email', formData.email);
    data.append('message', formData.message);
    
    if (formData.images) {
      Array.from(formData.images).forEach((file) => {
        data.append('images', file);
      });
    }
    
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        body: data
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert('Enviado correctamente!');
        setFormData({ name: '', email: '', message: '', images: null });
      } else {
        alert('Error: ' + result.detail);
      }
    } catch (error) {
      alert('Error al enviar');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="Nombre"
        required
      />
      <input
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        placeholder="Email"
        required
      />
      <textarea
        value={formData.message}
        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
        placeholder="Mensaje"
      />
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => setFormData({ ...formData, images: e.target.files })}
        required
      />
      <button type="submit">Enviar</button>
    </form>
  );
}
```

## Estructura de Archivos

Las imágenes se guardan en:
```
/var/www/uploads/demo-requests/
  └── {request_id}/
      ├── 1_imagen1.jpg
      ├── 2_imagen2.png
      └── ...
```

## Flujo de Trabajo

1. Cliente completa el formulario en el frontend
2. Frontend envía POST a `/api/contact` con datos e imágenes
3. Backend valida y guarda imágenes en filesystem
4. Backend guarda metadata en base de datos
5. Backend envía email de notificación al encargado
6. Encargado recibe email con ID y rutas de imágenes
7. Encargado procesa y responde al cliente manualmente

## Seguridad

- ✅ Validación de tipo de archivo (solo imágenes)
- ✅ Validación de tamaño (máx 5MB por imagen)
- ✅ Validación de cantidad (máx 5 imágenes)
- ✅ Endpoint público solo para POST `/api/contact`
- ✅ Endpoints GET requieren autenticación

## Mantenimiento

### Limpiar imágenes antiguas

Para limpiar solicitudes procesadas después de X días:

```python
# Script de limpieza (ejemplo)
import os
from datetime import datetime, timedelta
from pathlib import Path

UPLOAD_DIR = "/var/www/uploads/demo-requests"
DAYS_TO_KEEP = 30

for request_dir in Path(UPLOAD_DIR).iterdir():
    if request_dir.is_dir():
        # Verificar fecha de creación
        created = datetime.fromtimestamp(request_dir.stat().st_ctime)
        if datetime.now() - created > timedelta(days=DAYS_TO_KEEP):
            # Eliminar directorio
            import shutil
            shutil.rmtree(request_dir)
```

