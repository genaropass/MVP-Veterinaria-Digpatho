"use client";

import React from "react";
import { AnalysisResult } from "@/context/profile-context";

interface ResultsTabsProps {
  files: File[];
  results: Map<string, AnalysisResult | null>;
  activeTab: number | null;
  setActiveTab: (index: number) => void;
}

export default function ResultsTabs({ files, results, activeTab, setActiveTab }: ResultsTabsProps) {
  return (
    <div className="flex space-x-4 border-b">
      {/* Only filter and show files with results */}
      {files.filter((file) => results.get(file.name) !== null).map((file, index) => (
          <button key={file.name} onClick={() => setActiveTab(index)}
            className={`py-2 px-4 text-sm font-medium ${
              activeTab === index
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500"
            }`}
          >
            Imagen {index + 1}
          </button>
        ))}
    </div>
  );
}