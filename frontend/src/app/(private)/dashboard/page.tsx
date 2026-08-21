'use client';

import React, { useState, useEffect } from 'react';
import { UploadCloud, FileSearch, CheckCircle, AlertTriangle, User } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { analizarResultados } from "@/lib/analisis";
import valores_referencia from "@/data/valores_referencia.json";
import alteraciones from "@/data/alteraciones.json";
import SmearCanvas from "@/components/smear/SmearCanvas";

interface AnalysisResult {
  status: string;
  counts?: {
    neutro_abs: number;
    linfo_abs: number;
    mono_abs: number;
    eosino_abs: number;
    baso_abs: number;
  };
  clinical_alerts?: string[];
  image_info?: { width: number; height: number };
  message?: string;
  bounding_boxes?: any[];
}

export default function Dashboard() {
  // Shared patient data
  const [patientData, setPatientData] = useState({
    especie: 'canino', // must match JSON key ('canino' or 'felino')
    raza: '',
    edad: '',
    sexo: 'Macho',
  });

  // IA Upload state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [iaResults, setIaResults] = useState<AnalysisResult | null>(null);
  const [iaError, setIaError] = useState<string | null>(null);

  // Manual input state
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [manualAlerts, setManualAlerts] = useState<any[]>([]);

  // Derived patient object for analisis
  const pacienteObj = {
    especie: patientData.especie,
    raza: patientData.raza,
    sexo: patientData.sexo,
    edadMeses: patientData.edad ? parseInt(patientData.edad) * 12 : null
  };

  // ----- AI TAB LOGIC -----
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setIaResults(null);
      setIaError(null);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.type.startsWith('image/')) {
      setFile(dropped);
      setIaResults(null);
      setIaError(null);
      setPreview(URL.createObjectURL(dropped));
    }
  };

  const handleAnalyzeIA = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setIaError(null);
    setIaResults(null);

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
      setIaResults(data);
    } catch (err: any) {
      setIaError(err.message ?? 'No se pudo conectar con el servidor de IA.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ----- MANUAL TAB LOGIC -----
  const handleManualInputChange = (key: string, value: string) => {
    setManualValues(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    // Run analysis whenever manual values or patient data changes
    try {
      const res = analizarResultados(manualValues, pacienteObj, valores_referencia, alteraciones);
      setManualAlerts(res.patrones || []);
    } catch(e) {
      console.error(e);
    }
  }, [manualValues, patientData]);


  // ----- UI HELPERS -----
  const manualFields = [
    { key: 'wbc', label: 'WBC (Leucocitos)', placeholder: 'x10³/μL' },
    { key: 'rbc', label: 'RBC (Eritrocitos)', placeholder: 'x10⁶/μL' },
    { key: 'hgb', label: 'Hemoglobina', placeholder: 'g/dL' },
    { key: 'hct', label: 'Hematocrito', placeholder: '%' },
    { key: 'plt', label: 'Plaquetas', placeholder: 'x10³/μL' },
    { key: 'neutro_abs', label: 'Neutrófilos Abs', placeholder: 'x10³/μL' },
    { key: 'linfo_abs', label: 'Linfocitos Abs', placeholder: 'x10³/μL' },
    { key: 'eosino_abs', label: 'Eosinófilos Abs', placeholder: 'x10³/μL' }
  ];

  const cellCounts = iaResults?.counts
    ? [
        { label: 'Neutrófilos #', value: iaResults.counts.neutro_abs, normal: [3.0, 11.5] },
        { label: 'Linfocitos #', value: iaResults.counts.linfo_abs, normal: [1.0, 4.8] },
        { label: 'Eosinófilos #', value: iaResults.counts.eosino_abs, normal: [0.1, 1.25] },
        { label: 'Monocitos #', value: iaResults.counts.mono_abs, normal: [0.15, 1.35] },
        { label: 'Basófilos #', value: iaResults.counts.baso_abs, normal: [0, 0.1] },
      ]
    : [];

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard Veterinario</h1>
        <p className="text-gray-500 dark:text-gray-400">Análisis automático de citologías y frotis sanguíneos asistido por IA.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PATIENT DATA SIDEBAR */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 h-fit lg:sticky lg:top-8">
          <div className="flex items-center gap-2 mb-4 text-purple-700 dark:text-purple-400">
            <User className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Datos del Paciente</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">Especie</label>
              <select
                className="w-full border rounded-lg p-2 text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                value={patientData.especie}
                onChange={(e) => setPatientData({ ...patientData, especie: e.target.value })}
              >
                <option value="canino">Canino</option>
                <option value="felino">Felino</option>
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

        {/* MAIN WORK AREA */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="manual" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="manual">Ingreso Clínico Manual</TabsTrigger>
              <TabsTrigger value="ia">Análisis Visual IA</TabsTrigger>
            </TabsList>

            {/* TAB: MANUAL INPUT */}
            <TabsContent value="manual" className="space-y-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Valores del Hemograma</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {manualFields.map(field => (
                    <div key={field.key}>
                      <label className="block text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">{field.label}</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full border rounded-lg p-2 text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                        placeholder={field.placeholder}
                        value={manualValues[field.key] || ''}
                        onChange={(e) => handleManualInputChange(field.key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* MANUAL ALERTS */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4 text-purple-700 dark:text-purple-400">Interpretación Clínica</h3>
                {manualAlerts.length > 0 ? (
                  <div className="space-y-3">
                    {manualAlerts.map((alerta, i) => (
                      <div key={i} className={`p-4 rounded-lg border ${alerta.gravedad === 'grave' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 text-red-800 dark:text-red-300' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 text-amber-800 dark:text-amber-300'}`}>
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-sm">{alerta.nombre}</p>
                            <p className="text-sm mt-1">{alerta.descripcion}</p>
                            <p className="text-xs mt-2 opacity-80">Parámetros afectados: {alerta.parametros.join(', ').toUpperCase()}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-3 p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg border border-green-200 dark:border-green-700">
                    <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm">Todo en orden. Ingrese valores para ver alertas clínicas basadas en inteligencia médica.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB: IA */}
            <TabsContent value="ia" className="space-y-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Imagen de Citología</h2>
                <input type="file" id="file-upload" className="hidden" accept="image/*" onChange={handleFileChange} />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer block border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center hover:border-purple-400 transition-colors"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  {preview ? (
                    <img src={preview} alt="Vista previa" className="max-h-64 mx-auto rounded-lg object-contain" />
                  ) : (
                    <div className="py-8">
                      <UploadCloud className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <span className="text-sm text-gray-500">Arrastrá o hacé clic para subir la imagen microscópica</span>
                    </div>
                  )}
                  {file && <p className="mt-4 text-xs font-medium text-purple-600">{file.name}</p>}
                </label>

                <button
                  onClick={handleAnalyzeIA}
                  disabled={!file || isAnalyzing}
                  className="mt-5 w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-3 rounded-lg font-medium transition-colors flex justify-center items-center gap-2 shadow-sm"
                >
                  {isAnalyzing ? <FileSearch className="animate-pulse w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                  {isAnalyzing ? 'Analizando morfología con IA...' : 'Ejecutar Análisis Visual'}
                </button>
              </div>

              {iaError && (
                <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl">
                  <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                  <p className="text-sm">{iaError}</p>
                </div>
              )}

              {iaResults?.status === "sin_modelo" && (
                <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-xl">
                  <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">IA Visual Desactivada (Fase MVP)</p>
                    <p className="text-sm mt-1">{iaResults.message}</p>
                    <p className="text-sm mt-2 font-medium">Por favor, utilice la pestaña "Ingreso Clínico Manual".</p>
                  </div>
                </div>
              )}

              {iaResults?.counts && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-purple-700 dark:text-purple-400">Resultados Visuales</h2>
                    <span className="text-xs text-gray-400">{iaResults.image_info?.width}×{iaResults.image_info?.height}px</span>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 rounded-xl">
                    <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">Aviso Importante (Datos Simulados)</p>
                      <p className="text-sm mt-1">Los recuentos celulares absolutos mostrados a continuación son **valores simulados** para la versión de demostración del MVP, basados en el número de células segmentadas. No deben utilizarse para diagnóstico clínico real hasta que se integre el modelo de clasificación definitivo.</p>
                    </div>
                  </div>

                  {preview && iaResults.bounding_boxes && iaResults.image_info && (
                    <SmearCanvas 
                      imageSrc={preview} 
                      bboxes={iaResults.bounding_boxes} 
                      originalWidth={iaResults.image_info.width}
                      originalHeight={iaResults.image_info.height}
                    />
                  )}

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
                          <div className={`text-xl font-bold ${isAbnormal ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-white'}`}>
                            {value}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {iaResults.clinical_alerts && iaResults.clinical_alerts.length > 0 && (
                    <div className="mt-6 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                      <h3 className="font-semibold text-orange-800 dark:text-orange-300 mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Alertas Morfométricas (IA)
                      </h3>
                      <ul className="list-disc pl-5 text-sm text-orange-700 dark:text-orange-400 space-y-1">
                        {iaResults.clinical_alerts.map((alert, i) => (
                          <li key={i}>{alert}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                </div>
              )}
            </TabsContent>

          </Tabs>
        </div>
      </div>
    </div>
  );
}
