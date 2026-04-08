"use client";

import { useState } from "react";
import { Download } from "lucide-react";

interface CsvDownloadButtonProps {
  sourceKey: string;
  label?: string;
}

export default function CsvDownloadButton({ sourceKey, label }: CsvDownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/demo/fuji-electric/csv?source=${sourceKey}`);
      if (!res.ok) return;

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? `${sourceKey}.csv`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      title={label ? `${label}をCSVダウンロード` : "CSVダウンロード"}
      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all disabled:opacity-50"
    >
      <Download className={`h-3 w-3 ${loading ? "animate-bounce" : ""}`} />
      CSV
    </button>
  );
}
