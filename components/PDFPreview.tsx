
import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Zap } from 'lucide-react';

// Ensure worker is configured matching the import map version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs`;

interface PDFPreviewProps {
  file: File;
  currentPage: number;
  onTotalPages: (total: number) => void;
}

export const PDFPreview: React.FC<PDFPreviewProps> = ({ file, currentPage, onTotalPages }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);

  // Load PDF Document
  useEffect(() => {
    const loadPdf = async () => {
      setLoading(true);
      try {
        const buffer = await file.arrayBuffer();
        const loadedPdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
        setPdfDoc(loadedPdf);
        onTotalPages(loadedPdf.numPages);
        setLoading(false);
      } catch (err) {
        console.error("Error loading PDF", err);
        setLoading(false);
      }
    };
    loadPdf();
  }, [file]);

  // Render Specific Page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    
    let renderTask: any = null;

    const renderPage = async () => {
      try {
        // Ensure page request is valid
        const safePageNum = Math.max(1, Math.min(currentPage, pdfDoc.numPages));
        const page = await pdfDoc.getPage(safePageNum);
        
        // Scale 1.5 provides crisp quality for engineering drawings
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d')!;
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          canvas
        };
        
        // Cast to any to handle potential type mismatch with pdfjs-dist versions
        renderTask = page.render(renderContext as any);
        await renderTask.promise;
      } catch (e) {
        console.error("Page render error", e);
      }
    };

    renderPage();

    return () => {
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, currentPage]);

  if (loading) {
    return (
      <div className="min-h-[600px] flex flex-col items-center justify-center space-y-6 animate-fade-in pt-20">
        <div className="w-16 h-16 border-4 border-slate-100 border-t-brand-600 rounded-full animate-spin"></div>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Rasterizing Vector Data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-6 animate-fade-in flex flex-col items-center pb-32 relative">
      <div className="relative w-full bg-slate-900 p-1 rounded-xl shadow-2xl overflow-hidden ring-1 ring-slate-900/10">
        <canvas ref={canvasRef} className="block w-full h-auto bg-white rounded-lg opacity-95" />
      </div>
      
      <div className="mt-8 flex items-center gap-3 text-slate-300 opacity-60 hover:opacity-100 transition-opacity select-none">
        <Zap className="w-3 h-3" />
        <span className="text-[9px] font-black uppercase tracking-[0.3em]">AI Vision Ready</span>
      </div>
    </div>
  );
};
