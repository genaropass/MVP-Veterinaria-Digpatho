'use client';

import React, { useState } from 'react';
import { UploadCloud, FileSearch, CheckCircle, AlertTriangle } from 'lucide-react';

interface AnalysisResult {
  status: string;
  counts: {
    neutro_abs: number;
    linfo_abs: number;
    mono_abs: number;
    eosino_abs: number;
    baso_abs: number;
  };
  clinical_alerts: string[];
  image_info: { width: number; height: number };
}

export default function Dashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [patientData, setPatientData] = useState({
    especie: 'Canino',
    raza: '',
    edad: '',
    sexo: 'Macho',
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResults(null);
      setError(null);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.type.startsWith('image/')) {
      setFile(dropped);
      setResults(null);
      setError(null);
      setPreview(URL.createObjectURL(dropped));
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setError(null);
    setResults(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('especie', patientData.especie);
    formData.append('raza', patientData.raza);
    formData.append('edad', patientData.edad);
    formData.append('sexo', patientData.sexo);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/v1/analyze-smear`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? 'Error en el servidor de análisis.');
      }

      const data: AnalysisResult = await res.json();
      setResults(data);
    } catch (err: any) {
      setError(err.message ?? 'No se pudo conectar con el servidor de IA. ¿Está el backend corriendo en el puerto 8000?');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const cellCounts = results
    ? [
        { label: 'Neutrófilos #', value: results.counts.neutro_abs, normal: [3.0, 11.5] },
        { label: 'Linfocitos #', value: results.counts.linfo_abs, normal: [1.0, 4.8] },
        { label: 'Eosinófilos #', value: results.counts.eosino_abs, normal: [0.1, 1.25] },
        { label: 'Monocitos #', value: results.counts.mono_abs, normal: [0.15, 1.35] },
        { label: 'Basófilos #', value: results.counts.baso_abs, normal: [0, 0.1] },
      ]
    : [];

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard Veterinario</h1>
        <p className="text-gray-500 dark:text-gray-400">Análisis automático de citologías y frotis sanguíneos asistido por IA.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Datos del Paciente */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Datos del Paciente</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">Especie</label>
              <select
                className="w-full border rounded-lg p-2 text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                value={patientData.especie}
                onChange={(e) => setPatientData({ ...patientData, especie: e.target.value })}
              >
                <option value="Canino">Canino</option>
                <option value="Felino">Felino</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">Raza</label>
              <input
                type="text"
                className="w-full border rounded-lg p-2 text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                placeholder="Ej. Labrador"
                value={patientData.raza}
                onChange={(e) => setPatientData({ ...patientData, raza: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">Edad (años)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg p-2 text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                  placeholder="0"
                  min="0"
                  value={patientData.edad}
                  onChange={(e) => setPatientData({ ...patientData, edad: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">Sexo</label>
                <select
                  className="w-full border rounded-lg p-2 text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                  value={patientData.sexo}
                  onChange={(e) => setPatientData({ ...patientData, sexo: e.target.value })}
                >
                  <option value="Macho">Macho</option>
                  <option value="Hembra">Hembra</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Subida de Citología */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Imagen de Citología</h2>
            <input type="file" id="file-upload" className="hidden" accept="image/*" onChange={handleFileChange} />
            <label
              htmlFor="file-upload"
              className="cursor-pointer block border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center hover:border-purple-400 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              {preview ? (
                <img src={preview} alt="Vista previa" className="max-h-32 mx-auto rounded-lg object-contain" />
              ) : (
                <>
                  <UploadCloud className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <span className="text-sm text-gray-500">Arrastrá o hacé clic para subir la imagen</span>
                </>
              )}
              {file && <p className="mt-2 text-xs font-medium text-purple-600">{file.name}</p>}
            </label>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={!file || isAnalyzing}
            className="mt-5 w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-3 rounded-lg font-medium transition-colors flex justify-center items-center gap-2"
          >
            {isAnalyzing ? <FileSearch className="animate-pulse w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
            {isAnalyzing ? 'Analizando con IA...' : 'Ejecutar Análisis'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Resultados */}
      {results && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-purple-700 dark:text-purple-400">Resultados del Análisis</h2>
            <span className="text-xs text-gray-400">{results.image_info.width}×{results.image_info.height}px</span>
          </div>

          {/* Conteos celulares */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {cellCounts.map(({ label, value, normal }) => {
              const isHigh = value > normal[1];
              const isLow = value < normal[0];
              const isAbnormal = isHigh || isLow;
              return (
                <div
                  key={label}
                  className={`p-4 rounded-lg text-center border ${
                    isAbnormal
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-700'
                  }`}
                >
                  <div className={`text-xs mb-1 ${isAbnormal ? 'text-red-500' : 'text-gray-500'}`}>{label}</div>
                  <div className={`text-2xl font-bold ${isAbnormal ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-white'}`}>
                    {value}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">x10³/μL</div>
                  {isHigh && <div className="text-xs text-red-500 font-medium mt-1">↑ Alto</div>}
                  {isLow && <div className="text-xs text-blue-500 font-medium mt-1">↓ Bajo</div>}
                </div>
              );
            })}
          </div>

          {/* Alertas clínicas */}
          {results.clinical_alerts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Interpretación Clínica:</h3>
              {results.clinical_alerts.map((alerta, i) => (
                <div
                  key={i}
                  className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-lg border border-amber-200 dark:border-amber-700"
                >
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm">{alerta}</p>
                </div>
              ))}
            </div>
          )}

          {results.clinical_alerts.length === 0 && (
            <div className="flex gap-3 p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg border border-green-200 dark:border-green-700">
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm">Sin alteraciones clínicas detectadas. Recuentos dentro de rangos normales.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
