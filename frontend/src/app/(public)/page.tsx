import Link from "next/link";
import { ArrowRight, Activity, ShieldCheck, Microscope } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navbar */}
      <header className="bg-white border-b border-gray-100 py-4 px-6 md:px-12 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-purple-600 p-2 rounded-lg">
            <Microscope className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-800 tracking-tight">Digpatho<span className="text-purple-600">Vet</span></span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
          <a href="#features" className="hover:text-purple-600 transition-colors">Características</a>
          <a href="#how-it-works" className="hover:text-purple-600 transition-colors">Cómo funciona</a>
          <Link href="/dashboard" className="bg-purple-600 text-white px-5 py-2.5 rounded-full hover:bg-purple-700 transition-all font-semibold shadow-sm">
            Probar Plataforma
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden bg-white pt-20 pb-28 px-6 text-center">
          <div className="absolute inset-0 z-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
          <div className="relative z-10 max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-100 text-purple-700 text-sm font-medium mb-6">
              <span className="flex h-2 w-2 rounded-full bg-purple-600"></span>
              Modelo Predictivo Híbrido Activo
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight mb-8 leading-tight">
              Citología Veterinaria de <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">Precisión</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              Analizá frotis sanguíneos en segundos. DigpathoVet cruza visión artificial con reglas clínicas veterinarias para detectar alteraciones morfológicas y predecir patologías antes de que sean críticas.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/dashboard" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-purple-600 text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-purple-700 transition-transform hover:scale-105 shadow-lg shadow-purple-200">
                Iniciar Diagnóstico <ArrowRight className="w-5 h-5" />
              </Link>
              <a href="#demo" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-gray-700 border-2 border-gray-200 px-8 py-4 rounded-full text-lg font-semibold hover:border-gray-300 hover:bg-gray-50 transition-colors">
                Ver Demo
              </a>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 px-6 bg-slate-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Tecnología diseñada para Clínicas</h2>
              <p className="text-gray-600 max-w-xl mx-auto">No necesitás escáneres costosos. Subí la foto desde el ocular de tu microscopio y nuestro motor hace el resto.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="bg-blue-100 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                  <ShieldCheck className="w-7 h-7 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Filtro Pre-analítico (IA)</h3>
                <p className="text-gray-600 leading-relaxed">Evaluamos automáticamente la calidad de la tinción, el enfoque y la exposición de tu imagen antes de procesarla para garantizar precisión.</p>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="bg-purple-100 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                  <Microscope className="w-7 h-7 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Morfometría Celular</h3>
                <p className="text-gray-600 leading-relaxed">Detección de Anisocariosis, pleomorfismo y proyecciones citoplasmáticas mediante segmentación avanzada de contornos celulares.</p>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="bg-rose-100 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                  <Activity className="w-7 h-7 text-rose-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Motor Clínico Integrado</h3>
                <p className="text-gray-600 leading-relaxed">Las variables extraídas se cruzan con la especie, raza y edad del paciente para disparar alertas médicas reales (ej. Neutrofilia, Linfopenia).</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-4 opacity-50">
          <Microscope className="w-5 h-5" />
          <span className="text-lg font-bold text-white tracking-tight">DigpathoVet</span>
        </div>
        <p className="text-sm">© 2026 Digpatho. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}