import WsiChunkedUpload from "@/components/ui/WsiChunkedUpload";

export default function TestUploadPage() {
  return (
    <section className="min-h-screen bg-white dark:bg-gray-900 py-16 px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-purple-700 dark:text-purple-300">
            🧪 Test — Subida WSI por fragmentos
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Página de prueba (sin autenticación). Conectada a{" "}
            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-xs">
              {process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001/"}
            </code>
          </p>
        </div>

        <WsiChunkedUpload />

        <p className="text-center text-xs text-gray-400 mt-8">
          Esta página es solo para desarrollo local. No la subas a producción.
        </p>
      </div>
    </section>
  );
}
