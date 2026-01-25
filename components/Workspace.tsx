
import React, { useState } from 'react';
import { ProjectState } from '../types';
import { Ingestion } from './Ingestion';
import { PDFPreview } from './PDFPreview';
import { EngineeringDashboard } from './dashboard/EngineeringDashboard';
import { runFullEngineeringPipeline } from '../services/api';
import { Header } from './layout/Header';
import { Wind, Loader2, RefreshCcw, CheckCircle2, Database, Zap, Sparkles, ShieldCheck, ChevronLeft, ChevronRight, X, Play } from 'lucide-react';

const PROCESSING_STEPS = [
  { id: 1, label: 'Architectural Set Ingestion', icon: Database },
  { id: 2, label: 'Room Schedule Reconciliation', icon: Wind },
  { id: 3, label: 'Physics Simulation (J/D/T)', icon: Zap },
  { id: 4, label: 'Equipment Market Grounding', icon: Sparkles },
  { id: 5, label: 'Manual S Compliance Audit', icon: ShieldCheck },
];

export const Workspace: React.FC = () => {
  const [project, setProject] = useState<ProjectState | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'IDLE' | 'PROCESSING' | 'ERROR'>('IDLE');
  const [step, setStep] = useState(1);
  
  // PDF Navigation State
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);

  const startPipeline = async () => {
    if (!selectedFile) return;

    setStatus('PROCESSING');
    setStep(1);
    
    // Simulate step progression for UX while the backend works
    const stepInterval = setInterval(() => {
      setStep(prev => (prev < 5 ? prev + 1 : prev));
    }, 3000);

    try {
      const finalState = await runFullEngineeringPipeline(selectedFile);
      clearInterval(stepInterval);
      setProject(finalState);
      setStatus('IDLE');
      setSelectedFile(null); // Clear selected file after successful processing
    } catch (err) {
      clearInterval(stepInterval);
      setStatus('ERROR');
      console.error(err);
    }
  };

  const handleReset = () => {
    setProject(null);
    setSelectedFile(null);
    setStatus('IDLE');
    setPdfPage(1);
    setPdfTotalPages(0);
  };

  const handleIngestionFileSelect = (file: File) => {
    setSelectedFile(file);
    setPdfPage(1); // Reset to page 1 on new file
  };

  const handleCancelPreview = () => {
    setSelectedFile(null);
    setPdfPage(1);
    setPdfTotalPages(0);
  };

  // --- HEADER CONTENT GENERATORS ---

  const getHeaderCenterContent = () => {
    if (selectedFile && !project && status === 'IDLE') {
      return (
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 max-w-[300px] truncate">
            {selectedFile.name}
          </span>
          <div className="flex items-center bg-slate-100 rounded-full p-1 border border-slate-200 shadow-inner">
             <button 
               onClick={() => setPdfPage(p => Math.max(1, p - 1))}
               disabled={pdfPage <= 1}
               className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white hover:shadow-sm text-slate-500 hover:text-slate-900 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
             >
               <ChevronLeft className="w-4 h-4" />
             </button>
             <div className="px-4 font-mono font-bold text-xs text-slate-700 select-none min-w-[3rem] text-center">
               {pdfPage} / {pdfTotalPages || '-'}
             </div>
             <button 
               onClick={() => setPdfPage(p => Math.min(pdfTotalPages || 1, p + 1))}
               disabled={pdfPage >= (pdfTotalPages || 1)}
               className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white hover:shadow-sm text-slate-500 hover:text-slate-900 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
             >
               <ChevronRight className="w-4 h-4" />
             </button>
          </div>
        </div>
      );
    }
    return null;
  };

  const getHeaderRightContent = () => {
    if (selectedFile && !project && status === 'IDLE') {
      return (
        <div className="flex items-center gap-3">
           <button 
             onClick={handleCancelPreview}
             className="px-6 py-2.5 rounded-full font-bold text-xs uppercase tracking-widest text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all"
           >
             Cancel
           </button>
           <button 
             onClick={startPipeline}
             className="group px-6 py-2.5 bg-brand-600 text-white rounded-full font-black text-xs uppercase tracking-widest shadow-lg shadow-brand-500/30 flex items-center gap-2 transition-all hover:bg-brand-500 hover:scale-105 active:scale-95 border border-brand-400"
           >
             <Zap className="w-4 h-4 fill-white group-hover:animate-pulse" /> Run Assessment
           </button>
        </div>
      );
    }
    return null;
  };

  // --- RENDER STATES ---

  // 1. LOADING SCREEN
  if (status === 'PROCESSING') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-white animate-fade-in">
        <div className="max-w-md w-full space-y-12">
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 border-4 border-slate-800 border-t-brand-500 rounded-full animate-spin"></div>
              <Wind className="w-10 h-10 text-white absolute inset-0 m-auto animate-pulse" />
            </div>
            <div className="text-center">
              <h2 className="text-3xl font-black tracking-tighter uppercase">Pipeline Active</h2>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-2">Professional Submittal Generation</p>
            </div>
          </div>

          <div className="space-y-4">
            {PROCESSING_STEPS.map((s) => {
              const isActive = step === s.id;
              const isPast = step > s.id;
              const Icon = s.icon;
              return (
                <div key={s.id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${isActive ? 'bg-white/10 border-white/20 scale-105' : 'bg-transparent border-transparent opacity-40'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isPast ? 'bg-emerald-500' : isActive ? 'bg-brand-600' : 'bg-slate-800'}`}>
                    {isPast ? <CheckCircle2 className="w-5 h-5 text-white" /> : <Icon className="w-5 h-5 text-white" />}
                  </div>
                  <span className={`text-sm font-black uppercase tracking-widest ${isActive ? 'text-white' : 'text-slate-500'}`}>{s.label}</span>
                  {isActive && <Loader2 className="w-4 h-4 ml-auto animate-spin text-brand-500" />}
                </div>
              );
            })}
          </div>

          <div className="p-6 bg-slate-900 rounded-[2rem] border border-slate-800">
             <div className="flex justify-between mb-4">
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Compute Progress</span>
               <span className="text-[10px] font-black text-brand-500 uppercase tracking-widest">{Math.round((step/5)*100)}%</span>
             </div>
             <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
               <div className="h-full bg-brand-500 transition-all duration-700" style={{ width: `${(step/5)*100}%` }}></div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. ERROR SCREEN
  if (status === 'ERROR') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-slate-50 animate-fade-in">
        <div className="max-w-md w-full text-center space-y-6">
           <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mx-auto border border-red-100">
              <RefreshCcw className="w-10 h-10" />
           </div>
           <h2 className="text-2xl font-black text-slate-900 uppercase">Engine Failure</h2>
           <p className="text-slate-500 font-medium">The architectural set could not be reconciled. Please ensure the PDF is a high-resolution 2D plan set.</p>
           <button onClick={() => setStatus('IDLE')} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl">Restart Ingestion</button>
        </div>
      </div>
    );
  }

  // 3. MAIN WORKSPACE
  return (
    <div className={`min-h-screen ${project ? 'bg-slate-200' : 'bg-[#f8fafc]'} flex flex-col font-sans text-slate-900 antialiased`}>
      <Header 
        jobId={project?.id} 
        onReset={handleReset} 
        centerContent={getHeaderCenterContent()}
        rightContent={getHeaderRightContent()}
      />

      <main className="flex-1">
        {project ? (
          <EngineeringDashboard project={project} />
        ) : selectedFile ? (
          <PDFPreview 
            file={selectedFile} 
            currentPage={pdfPage}
            onTotalPages={setPdfTotalPages}
          />
        ) : (
          <div className="p-12">
            <Ingestion onFileSelect={handleIngestionFileSelect} />
          </div>
        )}
      </main>
    </div>
  );
};
