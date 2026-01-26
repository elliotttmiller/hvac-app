// components/Workspace.tsx

import React, { useState, useEffect, useRef } from 'react';
import { ProjectState } from '../types';
import { Ingestion } from './Ingestion';
import { PDFPreview } from './PDFPreview';
import { EngineeringDashboard } from './dashboard/EngineeringDashboard';
import { runFullEngineeringPipeline } from '../services/api';
import { Header } from './layout/Header';
import { Wind, Loader2, RefreshCcw, CheckCircle2, Database, ScanEye, Terminal, Bug, X, ChevronLeft, ChevronRight, Zap } from 'lucide-react';

const PROCESSING_STEPS = [
  { id: 1, label: 'Plan Set Ingestion & Rasterization', icon: Database },
  { id: 2, label: 'AI Geometry Detection', icon: ScanEye },
  { id: 3, label: 'Room Schedule Reconciliation', icon: Wind },
];

export const Workspace: React.FC = () => {
  const [project, setProject] = useState<ProjectState | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'IDLE' | 'PROCESSING' | 'ERROR'>('IDLE');
  const [step, setStep] = useState(1);
  const [logs, setLogs] = useState<string[]>([]);
  const [showDebugLogs, setShowDebugLogs] = useState(false);
  
  // PDF Navigation State
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);

  // Auto-scroll logs
  const logsEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showDebugLogs || status === 'PROCESSING') {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, showDebugLogs, status]);

  const startPipeline = async () => {
    if (!selectedFile) return;

    setStatus('PROCESSING');
    setStep(1);
    setLogs([]);
    
    // Simulate step progression purely for the visuals alongside real logs
    const stepInterval = setInterval(() => {
      setStep(prev => (prev < 3 ? prev + 1 : prev));
    }, 2000);

    try {
      const finalState = await runFullEngineeringPipeline(selectedFile, (msg) => {
        setLogs(prev => [...prev, msg]);
      });
      clearInterval(stepInterval);
      setProject(finalState);
      setStatus('IDLE');
      setSelectedFile(null); 
    } catch (err) {
      clearInterval(stepInterval);
      setStatus('ERROR');
      setLogs(prev => [...prev, `[FATAL ERROR]: ${err instanceof Error ? err.message : String(err)}`]);
      console.error(err);
    }
  };

  const handleReset = () => {
    setProject(null);
    setSelectedFile(null);
    setStatus('IDLE');
    setPdfPage(1);
    setPdfTotalPages(0);
    setLogs([]);
    setShowDebugLogs(false);
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
             <ScanEye className="w-4 h-4 text-white group-hover:animate-pulse" /> Analyze Plan
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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-white animate-fade-in relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-900/20 via-slate-950 to-slate-950"></div>
        
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 relative z-10">
          
          {/* LEFT: STEPS */}
          <div className="space-y-10">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                 <div className="w-16 h-16 border-4 border-slate-800 border-t-brand-500 rounded-full animate-spin flex items-center justify-center">
                    <Wind className="w-6 h-6 text-white animate-pulse" />
                 </div>
                 <div>
                    <h2 className="text-3xl font-black tracking-tighter uppercase">Processing</h2>
                    <p className="text-brand-500 text-xs font-bold uppercase tracking-widest mt-1">Vision Pipeline Active</p>
                 </div>
              </div>
            </div>

            <div className="space-y-4">
              {PROCESSING_STEPS.map((s) => {
                const isActive = step === s.id;
                const isPast = step > s.id;
                const Icon = s.icon;
                return (
                  <div key={s.id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-500 ${isActive ? 'bg-white/10 border-white/20 translate-x-4' : 'bg-transparent border-transparent opacity-30'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-500 ${isPast ? 'bg-emerald-500' : isActive ? 'bg-brand-600' : 'bg-slate-800'}`}>
                      {isPast ? <CheckCircle2 className="w-5 h-5 text-white" /> : <Icon className="w-5 h-5 text-white" />}
                    </div>
                    <span className={`text-sm font-black uppercase tracking-widest ${isActive ? 'text-white' : 'text-slate-500'}`}>{s.label}</span>
                    {isActive && <Loader2 className="w-4 h-4 ml-auto animate-spin text-brand-500" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: TERMINAL */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl flex flex-col overflow-hidden h-[500px]">
             <div className="bg-slate-800 px-4 py-3 flex items-center gap-2 border-b border-slate-700">
                <Terminal className="w-4 h-4 text-slate-400" />
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Vision Stream</span>
                <div className="flex gap-1.5 ml-auto">
                   <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                   <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                </div>
             </div>
             <div className="flex-1 p-6 overflow-y-auto font-mono text-xs space-y-2 custom-scrollbar bg-slate-950/50">
                {logs.length === 0 && <span className="text-slate-600 animate-pulse">Initializing pipeline connection...</span>}
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-3 text-emerald-400/90 border-l-2 border-slate-800 pl-3 py-0.5 animate-fade-in">
                     <span className="text-slate-600 select-none opacity-50">{new Date().toLocaleTimeString()}</span>
                     <span className="break-all">{log}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
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
           <h2 className="text-2xl font-black text-slate-900 uppercase">Analysis Failure</h2>
           <p className="text-slate-500 font-medium">The architectural set could not be reconciled. Please ensure the PDF is a high-resolution 2D plan set.</p>
           
           <div className="bg-slate-900 rounded-xl p-4 text-left overflow-auto max-h-40">
             <p className="text-[10px] font-mono text-red-400 mb-2 uppercase tracking-widest">Error Log:</p>
             <div className="space-y-1">
               {logs.slice(-3).map((l, i) => (
                 <p key={i} className="text-[10px] font-mono text-slate-400 border-l-2 border-red-500 pl-2">{l}</p>
               ))}
             </div>
           </div>

           <div className="flex gap-4 justify-center">
             <button onClick={() => setStatus('IDLE')} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl">Restart Ingestion</button>
             <button onClick={() => setShowDebugLogs(true)} className="px-8 py-4 bg-slate-200 text-slate-900 rounded-2xl font-black uppercase tracking-widest shadow-sm flex items-center gap-2">
               <Bug className="w-5 h-5" /> Debug Logs
             </button>
           </div>
        </div>

        {/* Debug Logs Overlay (shown on error) */}
        {showDebugLogs && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex flex-col p-8">
            <div className="flex justify-between items-center mb-6 max-w-[1200px] mx-auto w-full">
               <div className="flex items-center gap-3">
                  <Bug className="w-6 h-6 text-red-500" />
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Live Engineering Logs</h3>
               </div>
               <button onClick={() => setShowDebugLogs(false)} className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all">
                  <X className="w-6 h-6" />
               </button>
            </div>
            <div className="flex-1 bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden max-w-[1200px] mx-auto w-full flex flex-col">
               <div className="bg-slate-800 px-6 py-4 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Diagnostic Trace - Pipeline Failure</span>
               </div>
               <div className="flex-1 p-8 overflow-y-auto font-mono text-sm space-y-3 bg-black/40 custom-scrollbar">
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-4 text-emerald-400/80 animate-fade-in border-b border-white/5 pb-2">
                       <span className="text-slate-600 shrink-0 font-bold">{i+1}.</span>
                       <span className="break-all">{log}</span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
               </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. MAIN WORKSPACE
  return (
    <div className={`min-h-screen ${project ? 'bg-slate-200' : 'bg-[#f8fafc]'} flex flex-col font-sans text-slate-900 antialiased`}>
      <Header 
        jobId={project?.id} 
        onReset={handleReset} 
        onDebugClick={() => setShowDebugLogs(true)}
        hasLogs={logs.length > 0}
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

      {/* Debug Logs Overlay */}
      {showDebugLogs && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex flex-col p-8 animate-fade-in">
          <div className="flex justify-between items-center mb-6 max-w-[1400px] mx-auto w-full">
             <div className="flex items-center gap-3 text-white">
                <Terminal className="w-6 h-6 text-brand-500" />
                <h3 className="text-xl font-black uppercase tracking-tighter">Live Vision Audit Trace</h3>
             </div>
             <button onClick={() => setShowDebugLogs(false)} className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all">
                <X className="w-6 h-6" />
             </button>
          </div>
          <div className="flex-1 bg-slate-900 rounded-[2.5rem] border border-slate-800 overflow-hidden max-w-[1400px] mx-auto w-full flex flex-col shadow-2xl">
             <div className="bg-slate-800 px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Vision Inference Trace</span>
                </div>
                <div className="flex gap-2">
                   <div className="px-3 py-1 bg-slate-700 rounded text-[9px] font-mono text-slate-300 uppercase">Status: {project ? 'COMPLETE' : 'IN_PROGRESS'}</div>
                   <div className="px-3 py-1 bg-slate-700 rounded text-[9px] font-mono text-slate-300 uppercase">Entries: {logs.length}</div>
                </div>
             </div>
             <div className="flex-1 p-10 overflow-y-auto font-mono text-sm space-y-4 bg-black/40 custom-scrollbar">
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-6 text-emerald-400/90 group animate-fade-in border-b border-white/5 pb-3">
                     <span className="text-slate-700 shrink-0 font-black w-8">{String(i+1).padStart(2, '0')}</span>
                     <div className="space-y-1 w-full">
                       <span className="block break-all leading-relaxed">{log}</span>
                       <span className="block text-[10px] text-slate-600 uppercase font-black tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Timestamp: {new Date().toLocaleTimeString()}</span>
                     </div>
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
                     <Terminal className="w-16 h-16 opacity-20" />
                     <p className="font-black uppercase tracking-widest text-xs">No active trace data found.</p>
                  </div>
                )}
                <div ref={logsEndRef} />
             </div>
          </div>
        </div>
      )}
    </div>
  );
};