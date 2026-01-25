
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { extractBlueprintData } from '../services/geminiService';
import { ProjectState, RoomData, SourceType, ConfidenceLevel } from '../types';
import { 
  Upload, FileImage, ArrowRight, FileText, RefreshCw, 
  FileSearch, ShieldCheck, Database, Layout, Eye, 
  Maximize2, Lock, Info, CheckCircle2, AlertCircle, Loader2,
  ChevronLeft, ChevronRight, Scan
} from 'lucide-react';
import { PDFDocument as PdfLibDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs`;

interface StageIngestionProps {
  onComplete: (rooms: RoomData[]) => void;
}

const SCAN_STEPS = [
  "Digitizing Full Architectural Set...",
  "Analyzing Individual Sheets...",
  "Resolving Cross-Sheet Geometry...",
  "Extracting Vector Metadata...",
  "Reconciling Room Schedules...",
  "Finalizing Physics Input Payload..."
];

export const StageIngestion: React.FC<StageIngestionProps> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isDigitizing, setIsDigitizing] = useState(false);
  const [digitizeProgress, setDigitizeProgress] = useState(0);
  const [scanStep, setScanStep] = useState(0);
  const [pdfMeta, setPdfMeta] = useState<{ pages: number; size: string } | null>(null);
  const [pdfProxy, setPdfProxy] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let interval: any;
    if (isScanning) {
      interval = setInterval(() => {
        setScanStep(prev => (prev < SCAN_STEPS.length - 1 ? prev + 1 : prev));
      }, 3000);
    } else {
      setScanStep(0);
    }
    return () => clearInterval(interval);
  }, [isScanning]);

  const renderPage = useCallback(async (pdf: pdfjsLib.PDFDocumentProxy, pageNum: number, targetCanvas: HTMLCanvasElement) => {
    setIsRendering(true);
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // High-fidelity scale
      const context = targetCanvas.getContext('2d');
      if (!context) return;

      targetCanvas.height = viewport.height;
      targetCanvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };
      await page.render(renderContext).promise;
    } catch (err) {
      console.error("Page Rendering Error:", err);
    } finally {
      setIsRendering(false);
    }
  }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const f = e.target.files[0];
      setFile(f);
      setCurrentPage(1);
      
      const reader = new FileReader();
      reader.onload = async () => {
        const result = reader.result as string;
        setPreview(result);

        if (f.type === 'application/pdf') {
          try {
            const arrayBuffer = await f.arrayBuffer();
            
            const pdfDoc = await PdfLibDocument.load(arrayBuffer);
            setPdfMeta({
              pages: pdfDoc.getPageCount(),
              size: (f.size / (1024 * 1024)).toFixed(2) + ' MB'
            });

            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            setPdfProxy(pdf);
            
            if (canvasRef.current) {
              await renderPage(pdf, 1, canvasRef.current);
            }
          } catch (err) {
            console.error("Document Audit Failed:", err);
          }
        } else {
          setPdfMeta(null);
          setPdfProxy(null);
          const img = new Image();
          img.onload = () => {
            const canvas = canvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext('2d');
              canvas.width = img.width;
              canvas.height = img.height;
              ctx?.drawImage(img, 0, 0);
            }
          };
          img.src = result;
        }
      };
      reader.readAsDataURL(f);
    }
  };

  const goToPage = async (num: number) => {
    if (!pdfProxy || num < 1 || num > pdfProxy.numPages || !canvasRef.current) return;
    setCurrentPage(num);
    await renderPage(pdfProxy, num, canvasRef.current);
  };

  const runAnalysis = async () => {
    if (!file || !preview) return;
    setIsDigitizing(true);
    setIsScanning(true);
    
    try {
      const imageParts: { data: string, mimeType: string }[] = [];

      if (pdfProxy) {
        // MULTI-PAGE RASTERIZATION PIPELINE
        const totalPages = pdfProxy.numPages;
        const hiddenCanvas = hiddenCanvasRef.current;
        if (!hiddenCanvas) throw new Error("Hidden Canvas Missing");

        for (let i = 1; i <= totalPages; i++) {
          setDigitizeProgress(Math.round((i / totalPages) * 100));
          await renderPage(pdfProxy, i, hiddenCanvas);
          const base64 = hiddenCanvas.toDataURL('image/jpeg', 0.8).split(',')[1];
          imageParts.push({ data: base64, mimeType: 'image/jpeg' });
        }
      } else {
        // SINGLE IMAGE FALLBACK
        const base64 = preview.split(',')[1];
        imageParts.push({ data: base64, mimeType: file.type });
      }

      setIsDigitizing(false);
      const jsonStr = await extractBlueprintData(imageParts);
      const data = JSON.parse(jsonStr);
      
      const rooms: RoomData[] = (data.rooms || []).map((r: any, i: number) => ({
        id: `r-${i}`,
        name: r.name || `Zone ${i + 1}`,
        area: {
          value: Number(r.area) || 0,
          unit: 'sq ft',
          source: SourceType.AI_VISION,
          citation: `Vision Core Sheet Reconciliation Pass`,
          confidence: (r.confidence || ConfidenceLevel.MEDIUM) as ConfidenceLevel,
          timestamp: new Date().toISOString(),
          id: `v-${i}`
        },
        exteriorWallLength: Number(r.exteriorWallLength) || 0,
        windowsArea: Number(r.windowsArea) || 0,
        construction: {
          wallType: r.wallType || 'Standard Frame',
          rValue: 19,
          uValue: 0.05,
          glazingRatio: (Number(r.windowsArea) / (Number(r.exteriorWallLength) * 9 + 1)) || 0.15
        }
      }));
      
      onComplete(rooms);
    } catch (err) {
      console.error("Stage 1 Pipeline Failure:", err);
      alert("Vision Pipeline Error. Please check document quality.");
    } finally {
      setIsScanning(false);
      setIsDigitizing(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto animate-fade-in h-full flex flex-col">
      {/* Hidden Canvas for rasterization */}
      <canvas ref={hiddenCanvasRef} className="hidden" />

      <div className="mb-10 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Stage 1: Ingestion & Vision</h2>
          <p className="text-slate-500 mt-2 text-lg font-medium">Full-set architectural analysis with cross-sheet reconciliation.</p>
        </div>
        {file && !isScanning && (
           <button 
             onClick={() => fileInputRef.current?.click()}
             className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
           >
             <RefreshCw className="w-3.5 h-3.5" /> New Set
           </button>
        )}
      </div>

      {!file ? (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="group relative rounded-[3rem] border-4 border-dashed border-slate-200 bg-white min-h-[500px] flex flex-col items-center justify-center p-20 cursor-pointer hover:border-brand-500 hover:bg-brand-50/30 transition-all duration-700 overflow-hidden"
        >
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile} accept="image/*,application/pdf" />
          <div className="w-32 h-32 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-10 group-hover:scale-110 group-hover:bg-white transition-all duration-500 shadow-sm border border-slate-100">
            <Upload className="w-12 h-12 text-slate-300 group-hover:text-brand-600 transition-colors" />
          </div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tight">Upload Architectural Set</h3>
          <p className="text-slate-500 mt-4 max-w-[400px] text-center text-lg leading-relaxed">
            Upload multi-page submittals. Our engine individually digitizes every sheet to ensure comprehensive geometric extraction.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 flex-1">
          {/* LEFT: ARCHITECTURAL VIEWPORT */}
          <div className="xl:col-span-8 flex flex-col gap-4">
             <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-slate-950 rounded-lg flex items-center justify-center">
                      <Eye className="w-4 h-4 text-white" />
                   </div>
                   <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Architectural Viewport</h4>
                </div>
                
                {pdfMeta && (
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3 bg-slate-950 px-4 py-1.5 rounded-full border border-slate-800 shadow-lg">
                       <button 
                         disabled={currentPage <= 1 || isRendering || isScanning} 
                         onClick={() => goToPage(currentPage - 1)}
                         className="p-1 hover:bg-slate-800 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                       >
                         <ChevronLeft className="w-4 h-4 text-white" />
                       </button>
                       <span className="text-[10px] font-black text-white uppercase tracking-widest min-w-[80px] text-center">
                         Sheet {currentPage} of {pdfMeta.pages}
                       </span>
                       <button 
                         disabled={currentPage >= pdfMeta.pages || isRendering || isScanning} 
                         onClick={() => goToPage(currentPage + 1)}
                         className="p-1 hover:bg-slate-800 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                       >
                         <ChevronRight className="w-4 h-4 text-white" />
                       </button>
                    </div>

                    <div className="flex gap-4">
                      <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-100">
                        <CheckCircle2 className="w-3 h-3" /> Secure Set Ready
                      </span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{pdfMeta.size}</span>
                    </div>
                  </div>
                )}
             </div>
             
             <div className="flex-1 bg-slate-900 rounded-[2.5rem] border-4 border-slate-800 shadow-2xl relative overflow-auto custom-scrollbar min-h-[600px] group flex justify-center p-8">
                {(isRendering || isDigitizing) && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-900/50 backdrop-blur-sm">
                    <Loader2 className="w-10 h-10 text-brand-500 animate-spin mb-4" />
                    <p className="text-xs font-black text-white uppercase tracking-widest">
                      {isDigitizing ? `Digitizing Sheet ${Math.round(digitizeProgress / (100/pdfMeta!.pages)) + 1}...` : `Rendering Layer ${currentPage}...`}
                    </p>
                    {isDigitizing && (
                       <div className="w-48 h-1 bg-slate-800 rounded-full mt-4 overflow-hidden">
                          <div className="h-full bg-brand-500 transition-all duration-300" style={{ width: `${digitizeProgress}%` }} />
                       </div>
                    )}
                  </div>
                )}

                <canvas 
                  ref={canvasRef} 
                  className="rounded-lg shadow-2xl bg-white"
                />
                
                {isScanning && !isDigitizing && (
                  <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
                    <div className="w-full h-4 bg-brand-500/30 shadow-[0_0_100px_rgba(14,165,233,1)] animate-scan relative">
                       <div className="absolute inset-0 bg-brand-400/50 blur-xl"></div>
                    </div>
                  </div>
                )}
             </div>
          </div>

          {/* RIGHT: AI EXTRACTION HUB */}
          <div className="xl:col-span-4 flex flex-col gap-6">
             <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm h-full flex flex-col">
                <div className="flex items-center gap-4 mb-10">
                   <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${isScanning ? 'bg-brand-600 scale-110 shadow-lg shadow-brand-500/20' : 'bg-slate-900'}`}>
                      {isScanning ? <Scan className="w-7 h-7 text-white animate-pulse" /> : <Database className="w-7 h-7 text-white" />}
                   </div>
                   <div>
                      <h4 className="font-black text-slate-900 text-lg leading-tight uppercase tracking-tighter">AI Set Analysis</h4>
                      <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mt-1">
                        {isScanning ? SCAN_STEPS[scanStep] : 'READY FOR MULTI-SHEET PASS'}
                      </p>
                   </div>
                </div>

                <div className="space-y-6 flex-1">
                   <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Lock className="w-3 h-3" /> Multi-Sheet Submittal
                      </h5>
                      <p className="font-bold text-slate-900 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-tight">
                        {pdfMeta ? `${pdfMeta.pages} Sheets` : '1 Image'} • {file.type.split('/')[1]}
                      </p>
                   </div>

                   <div className="space-y-4">
                      <div className="flex items-center gap-4 text-slate-400 group">
                         <div className="w-2 h-2 rounded-full bg-slate-200 group-hover:bg-brand-500 transition-colors"></div>
                         <p className="text-xs font-bold leading-tight">Sequential Sheet Rasterization (2.0x Scale)</p>
                      </div>
                      <div className="flex items-center gap-4 text-slate-400 group">
                         <div className="w-2 h-2 rounded-full bg-slate-200 group-hover:bg-brand-500 transition-colors"></div>
                         <p className="text-xs font-bold leading-tight">Cross-Reference Geometric Reconciliation</p>
                      </div>
                      <div className="flex items-center gap-4 text-slate-400 group">
                         <div className="w-2 h-2 rounded-full bg-slate-200 group-hover:bg-brand-500 transition-colors"></div>
                         <p className="text-xs font-bold leading-tight">Global Zone Schedule Aggregation</p>
                      </div>
                   </div>
                </div>

                <div className="mt-10 space-y-4">
                   {isScanning && (
                      <div className="bg-brand-50 p-6 rounded-2xl border border-brand-100 flex items-start gap-4 animate-fade-in">
                         <Info className="w-5 h-5 text-brand-600 mt-0.5" />
                         <p className="text-xs text-brand-900 leading-relaxed font-medium">
                            The vision core is processing {pdfMeta?.pages || 1} individual sheets. This prevents geometric loss compared to single-page analysis.
                         </p>
                      </div>
                   )}
                   
                   <button
                     onClick={runAnalysis}
                     disabled={isScanning || isRendering}
                     className={`
                       w-full py-6 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all shadow-xl active:scale-95
                       ${isScanning || isRendering
                         ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                         : 'bg-slate-900 text-white hover:bg-slate-800 hover:-translate-y-1 shadow-brand-500/10'}
                     `}
                   >
                     {isScanning ? (
                       <><RefreshCw className="w-5 h-5 animate-spin" /> {isDigitizing ? 'Digitizing...' : 'Reconciling...'}</>
                     ) : (
                       <><ArrowRight className="w-5 h-5" /> Analyze Full Set</>
                     )}
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
