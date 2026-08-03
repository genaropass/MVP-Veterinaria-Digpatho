"use client";

import { useEffect, useState } from "react";

export default function SessionDebug() {
  const [serverSession, setServerSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/debug/session")
      .then((res) => res.json())
      .then((data) => {
        console.log("🔐 Server Session Debug:", data);
        setServerSession(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching session:", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="p-4 bg-gray-100 rounded mt-4">
      <h3 className="font-bold mb-2">🔐 Session Debug Info:</h3>
      <pre className="text-xs overflow-auto bg-white p-2 rounded">
        {JSON.stringify(serverSession, null, 2)}
      </pre>
    </div>
  );
}
