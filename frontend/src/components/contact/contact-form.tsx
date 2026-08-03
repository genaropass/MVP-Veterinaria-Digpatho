"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, X, Upload, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { HOST } from "@/utils/constants";

interface ImagePreview {
  file: File;
  preview: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 5;
const MIN_FILES = 1;

export default function ContactForm() {
  const t = useTranslations("contact");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    images?: string;
  }>({});

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    const newImages: ImagePreview[] = [];
    const newErrors: string[] = [];

    // Validar cantidad total antes de procesar
    if (images.length + fileArray.length > MAX_FILES) {
      const errorMsg = t("error-max-files", { max: MAX_FILES });
      setErrors((prev) => ({
        ...prev,
        images: errorMsg,
      }));
      toast.error(errorMsg);
      e.target.value = "";
      return;
    }

    // Procesar cada archivo
    const processFile = (file: File): Promise<ImagePreview | null> => {
      return new Promise((resolve) => {
        // Validar tipo de archivo
        if (!file.type.startsWith("image/")) {
          newErrors.push(t("error-invalid-image", { filename: file.name }));
          resolve(null);
          return;
        }

        // Validar tamaño
        if (file.size > MAX_FILE_SIZE) {
          newErrors.push(t("error-file-too-large", { filename: file.name }));
          resolve(null);
          return;
        }

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            file,
            preview: reader.result as string,
          });
        };
        reader.onerror = () => {
          newErrors.push(t("error-invalid-image", { filename: file.name }));
          resolve(null);
        };
        reader.readAsDataURL(file);
      });
    };

    // Procesar todos los archivos en paralelo
    const results = await Promise.all(fileArray.map(processFile));
    
    // Filtrar resultados nulos y agregar a newImages
    results.forEach((result) => {
      if (result) {
        newImages.push(result);
      }
    });

    // Actualizar estado con las imágenes válidas
    if (newImages.length > 0) {
      setImages((prev) => [...prev, ...newImages]);
      setErrors((prev) => ({ ...prev, images: undefined }));
    }

    // Mostrar errores si hay
    if (newErrors.length > 0) {
      setErrors((prev) => ({
        ...prev,
        images: newErrors.join(", "),
      }));
      toast.error(newErrors[0]);
    }

    // Reset input
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) => ({ ...prev, images: undefined }));
  };

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!name.trim()) {
      newErrors.name = t("error-name-required");
    }

    if (!email.trim()) {
      newErrors.email = t("error-email-required");
    } else if (!validateEmail(email)) {
      newErrors.email = t("error-email-invalid");
    }

    if (images.length < MIN_FILES) {
      newErrors.images = t("error-min-files", { min: MIN_FILES });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error(t("error-validation"));
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("email", email.trim());
      if (message.trim()) {
        formData.append("message", message.trim());
      }

      // Agregar imágenes con el nombre correcto
      images.forEach((image) => {
        formData.append("images", image.file, image.file.name);
      });

      console.log("📤 Enviando formulario de contacto:", {
        name: name.trim(),
        email: email.trim(),
        message: message.trim() || "(sin mensaje)",
        imagesCount: images.length,
        totalSize: images.reduce((sum, img) => sum + img.file.size, 0),
        endpoint: `${HOST}api/contact`,
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutos timeout

      const response = await fetch(`${HOST}api/contact`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
        // No establecer Content-Type manualmente, el navegador lo hace automáticamente con FormData
      });

      clearTimeout(timeoutId);

      console.log("📥 Respuesta del servidor:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (!response.ok) {
        let errorMessage = t("error-submit");
        
        // Intentar leer el error del servidor
        try {
          const errorText = await response.text();
          console.error("Error del servidor:", errorText);
          
          // Intentar parsear como JSON
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.detail || errorData.message || errorMessage;
          } catch {
            // Si no es JSON, usar el texto directamente si es útil
            if (errorText && errorText.length < 200) {
              errorMessage = errorText;
            }
          }
        } catch (parseError) {
          console.error("Error al parsear respuesta de error:", parseError);
        }

        // Mensajes específicos por código de estado
        if (response.status === 502) {
          errorMessage = "Server error (502). The service may be temporarily unavailable. Please try again later.";
        } else if (response.status === 504) {
          errorMessage = "Request timed out. Please try with fewer images or check your connection.";
        } else if (response.status === 413) {
          errorMessage = "Images are too large. Please reduce the image sizes.";
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log("✅ Solicitud enviada exitosamente:", data);

      // Reset form
      setName("");
      setEmail("");
      setMessage("");
      setImages([]);
      setErrors({});

      toast.success(t("success-message"));
    } catch (error: any) {
      console.error("❌ Error submitting form:", error);
      
      if (error.name === "AbortError") {
        toast.error("Request timed out. Please try with fewer images or check your connection.");
      } else {
        toast.error(error.message || t("error-submit"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name Field */}
      <div>
        <Label
          htmlFor="name"
          className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1"
        >
          {t("name-label")}
          <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErrors((prev) => ({ ...prev, name: undefined }));
          }}
          className={`mt-1 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 ${
            errors.name ? "border-red-300 focus:border-red-500" : ""
          }`}
          placeholder={t("name-placeholder")}
          disabled={loading}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-500">{errors.name}</p>
        )}
      </div>

      {/* Email Field */}
      <div>
        <Label
          htmlFor="email"
          className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1"
        >
          {t("email-label")}
          <span className="text-red-500">*</span>
        </Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErrors((prev) => ({ ...prev, email: undefined }));
          }}
          className={`mt-1 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 ${
            errors.email ? "border-red-300 focus:border-red-500" : ""
          }`}
          placeholder={t("email-placeholder")}
          disabled={loading}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-500">{errors.email}</p>
        )}
      </div>

      {/* Message Field */}
      <div>
        <Label
          htmlFor="message"
          className="text-sm font-medium text-gray-700 dark:text-gray-200"
        >
          {t("message-label")}
        </Label>
        <Textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          placeholder={t("message-placeholder")}
          rows={4}
          disabled={loading}
        />
      </div>

      {/* Images Field */}
      <div>
        <Label
          htmlFor="images"
          className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1"
        >
          {t("images-label")}
          <span className="text-red-500">*</span>
        </Label>
        <div className="mt-1">
          <div className="flex items-center justify-center w-full">
            <label
              htmlFor="images"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-2 text-gray-500 dark:text-gray-400" />
                <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-semibold">{t("upload-click")}</span>{" "}
                  {t("upload-drag")}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t("upload-requirements", {
                    min: MIN_FILES,
                    max: MAX_FILES,
                    size: "5MB",
                  })}
                </p>
              </div>
              <input
                id="images"
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                disabled={loading || images.length >= MAX_FILES}
              />
            </label>
          </div>

          {/* Image Previews */}
          {images.length > 0 && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
              {images.map((image, index) => (
                <div
                  key={index}
                  className="relative group rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600"
                >
                  <img
                    src={image.preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-32 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    disabled={loading}
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                    {image.file.name}
                  </div>
                </div>
              ))}
            </div>
          )}

          {errors.images && (
            <p className="mt-1 text-sm text-red-500">{errors.images}</p>
          )}

          {images.length > 0 && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {t("images-count", {
                current: images.length,
                max: MAX_FILES,
              })}
            </p>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full bg-purple-700 text-white hover:bg-purple-800 dark:bg-purple-600 dark:hover:bg-purple-700"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("submitting")}
          </>
        ) : (
          <>
            <ImageIcon className="mr-2 h-4 w-4" />
            {t("submit-button")}
          </>
        )}
      </Button>
    </form>
  );
}

