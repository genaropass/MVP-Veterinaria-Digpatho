"use client";

import React, { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, X, FileText, CheckCircle2, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { usePatient } from "@/context/patient-context";
import { uploadSimpleMode, uploadChunkedMode } from "@/services/wsiUploadService";
import { UPLOAD_THRESHOLD, API_TOKEN, HOST } from "@/utils/constants";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";

interface WsiUploaderProps {
	studyType: "ki67" | "estrogen" | "progesterone" | "her2";
	onUploadSuccess?: (imagenId: string) => void;
}

export default function WsiUploader({ studyType, onUploadSuccess }: WsiUploaderProps) {
	const { data: session } = useSession();
	const { pacienteId, informeId, setInformeId } = usePatient();

	const [file, setFile] = useState<File | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [progress, setProgress] = useState(0);
	const [uploadedImageId, setUploadedImageId] = useState<string | null>(null);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	const abortControllerRef = useRef<AbortController | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const rawToken = (session as any)?.accessToken;
	const isValidJWT = rawToken && typeof rawToken === "string" && rawToken.split(".").length === 3;
	const authToken = isValidJWT ? rawToken : API_TOKEN;

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files.length > 0) {
			setFile(e.target.files[0]);
			setErrorMsg(null);
			setUploadedImageId(null);
			setProgress(0);
		}
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		if (isUploading) return;

		if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
			setFile(e.dataTransfer.files[0]);
			setErrorMsg(null);
			setUploadedImageId(null);
			setProgress(0);
		}
	};

	const formatSize = (bytes: number) => {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
	};

	// Crear el informe si no existe
	const ensureInformeId = async (currentInformeId: string | null, currentPacienteId: string | null): Promise<string> => {
		if (currentInformeId && currentInformeId !== "new" && currentInformeId.trim() !== "") {
			return currentInformeId;
		}

		if (!currentPacienteId || currentPacienteId === "new" || currentPacienteId.trim() === "") {
			throw new Error("Debe seleccionar un paciente antes de realizar la subida.");
		}

		console.log("No se detectó un informe activo. Creando nuevo informe...");
		const now = new Date();
		const fechaMuestra = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

		const body = {
			paciente_id: currentPacienteId,
			fecha_de_muestra: fechaMuestra,
			tipo_estudio: studyType === "her2" ? "her2" : "ki67" // Ajustado al backend
		};

		const res = await apiFetch(`${HOST}informe/`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${authToken}`
			},
			body: JSON.stringify(body)
		});

		if (!res.ok) {
			const err = await res.json();
			throw new Error(err.detail || "No se pudo crear el informe en el servidor.");
		}

		const data = await res.json();
		const newInformeId = data.informe.id;
		setInformeId(newInformeId);
		return newInformeId;
	};

	const handleUpload = async () => {
		if (!file) return;

		setIsUploading(true);
		setErrorMsg(null);
		setProgress(0);
		abortControllerRef.current = new AbortController();

		try {
			// 1. Asegurar que tenemos un informeId válido
			const validInformeId = await ensureInformeId(informeId, pacienteId);

			// 2. Determinar modo de subida según el tamaño (90 MB)
			let imageId = "";
			if (file.size <= UPLOAD_THRESHOLD) {
				toast.info("Iniciando subida simple (archivo <= 90MB)...");
				imageId = await uploadSimpleMode(
					file,
					validInformeId,
					authToken,
					(p) => setProgress(p),
					abortControllerRef.current.signal
				);
			} else {
				toast.info(`Iniciando subida por fragmentos (archivo > 90MB: ${formatSize(file.size)})...`);
				imageId = await uploadChunkedMode(
					file,
					validInformeId,
					authToken,
					(p) => setProgress(p),
					abortControllerRef.current.signal
				);
			}

			setUploadedImageId(imageId);
			toast.success("¡Imagen WSI subida exitosamente!");
			if (onUploadSuccess) {
				onUploadSuccess(imageId);
			}
		} catch (err: any) {
			if (err.name === "AbortError") {
				toast.warning("Subida cancelada por el usuario.");
				setErrorMsg("Subida cancelada.");
			} else {
				console.error("Error al subir archivo WSI:", err);
				setErrorMsg(err.message || "Error desconocido al subir la imagen WSI.");
				toast.error(err.message || "Fallo en la subida.");
			}
		} finally {
			setIsUploading(false);
			abortControllerRef.current = null;
		}
	};

	const handleCancel = () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}
	};

	const handleRemoveFile = () => {
		setFile(null);
		setProgress(0);
		setUploadedImageId(null);
		setErrorMsg(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	return (
		<div className="space-y-4">
			{!file ? (
				<div
					onDragOver={handleDragOver}
					onDrop={handleDrop}
					className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition cursor-pointer bg-gray-50/50"
					onClick={() => fileInputRef.current?.click()}
				>
					<input
						type="file"
						ref={fileInputRef}
						onChange={handleFileSelect}
						className="hidden"
						accept=".svs,.tif,.tiff,.ndpi,.mrxs"
					/>
					<Upload className="mx-auto h-12 w-12 text-gray-400 mb-2" />
					<h3 className="font-semibold text-gray-700">Subir Imagen WSI Completa</h3>
					<p className="text-xs text-gray-500 mt-1">
						Arrastra y suelta tu archivo aquí, o haz clic para seleccionar
					</p>
					<p className="text-[10px] text-gray-400 mt-2">
						Soporta archivos grandes (.svs, .tif, .tiff, .ndpi, .mrxs). Los archivos mayores a 90MB se subirán en chunks.
					</p>
				</div>
			) : (
				<Card className="border border-gray-200 shadow-sm bg-white overflow-hidden">
					<CardContent className="p-4">
						<div className="flex items-start justify-between">
							<div className="flex items-center gap-3">
								<div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
									<FileText className="h-6 w-6" />
								</div>
								<div>
									<h4 className="font-medium text-sm text-gray-800 break-all">{file.name}</h4>
									<p className="text-xs text-gray-500">
										Tamaño: {formatSize(file.size)} • Tipo: {file.size > UPLOAD_THRESHOLD ? "Por fragmentos" : "Simple"}
									</p>
								</div>
							</div>
							{!isUploading && (
								<Button variant="ghost" size="icon" onClick={handleRemoveFile} className="text-gray-400 hover:text-gray-600 h-8 w-8">
									<X className="h-4 w-4" />
								</Button>
							)}
						</div>

						{/* Sección de progreso de subida */}
						{isUploading && (
							<div className="mt-4 space-y-2">
								<div className="flex justify-between text-xs font-medium text-gray-700">
									<span className="flex items-center gap-1">
										<Loader2 className="h-3 w-3 animate-spin text-primary" />
										Subiendo...
									</span>
									<span>{progress}%</span>
								</div>
								<Progress value={progress} className="h-2" />
								<div className="flex justify-end mt-1">
									<Button variant="outline" size="sm" onClick={handleCancel} className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 text-xs py-1 h-7">
										Cancelar subida
									</Button>
								</div>
							</div>
						)}

						{/* Resultados de subida exitosa */}
						{uploadedImageId && (
							<div className="mt-4 p-3 bg-green-50 text-green-800 rounded-lg border border-green-100 flex items-start gap-2">
								<CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
								<div className="text-xs">
									<p className="font-semibold">¡Subida exitosa!</p>
									<p className="mt-0.5 font-mono text-[10px] break-all">ID de Imagen: {uploadedImageId}</p>
								</div>
							</div>
						)}

						{/* Mensajes de error */}
						{errorMsg && (
							<div className="mt-4 p-3 bg-red-50 text-red-800 rounded-lg border border-red-100 flex items-start gap-2">
								<AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
								<div className="text-xs">
									<p className="font-semibold">Error al procesar la subida</p>
									<p className="mt-0.5 break-all">{errorMsg}</p>
								</div>
							</div>
						)}

						{/* Botón de acción */}
						{!isUploading && !uploadedImageId && (
							<div className="mt-4 flex justify-end gap-2">
								<Button size="sm" onClick={handleUpload} className="bg-primary text-white text-xs px-4 py-2">
									<Upload className="h-4 w-4 mr-1.5" />
									Comenzar Subida
								</Button>
							</div>
						)}

						{uploadedImageId && (
							<div className="mt-4 flex justify-end">
								<Button size="sm" variant="outline" onClick={handleRemoveFile} className="text-xs px-4 py-2">
									<RefreshCw className="h-4 w-4 mr-1.5" />
									Subir otro archivo
								</Button>
							</div>
						)}
					</CardContent>
				</Card>
			)}
		</div>
	);
}
