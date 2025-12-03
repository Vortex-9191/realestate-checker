'use client';

import { useEffect, useState } from 'react';

interface PdfViewerProps {
  file: File;
}

export default function PdfViewer({ file }: PdfViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Revoke previous URL to prevent memory leaks
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }

    try {
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      setError(null);
    } catch (err) {
      console.error('PDF URL creation error:', err);
      setError('PDFの読み込みに失敗しました');
    }

    // Cleanup on unmount
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [file]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
        <div className="text-center text-red-500">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">PDFを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-gray-100 rounded-lg overflow-hidden">
      <embed
        src={pdfUrl}
        type="application/pdf"
        className="w-full h-full"
        style={{ minHeight: '100%' }}
      />
    </div>
  );
}
