
import React, { useRef } from 'react';
import { Upload, FileText, Lock, CheckCircle2 } from 'lucide-react';

interface IngestionProps {
  onFileSelect: (file: File) => void;
}

export const Ingestion: React.FC<IngestionProps> = ({ onFileSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in space-y-12 py-12">
      <div 
        onClick={() => fileInputRef.current?.click()}
        className="group relative rounded-[4rem] border-4 border-dashed border-slate-200 bg-white min-h-[500px] flex flex-col items-center justify-center p-20 cursor-pointer hover:border-brand-500 hover:bg-brand-50/30 transition-all duration-700 overflow-hidden shadow-2xl shadow-slate-200/50"
      >
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile} accept="application/pdf" />
        
        <div className="w-40 h-40 bg-slate-50 rounded-[3rem] flex items-center justify-center mb-12 group-hover:scale-110 group-hover:bg-white transition-all duration-500 shadow-xl border border-slate-100 relative">
          <Upload className="w-16 h-16 text-slate-300 group-hover:text-brand-600 transition-colors" />
          <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center border-4 border-white">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
        </div>

        <h3 className="text-3xl font-black text-slate-900 tracking-tight">Upload Architectural Plan Set</h3>
        <p className="text-slate-500 mt-6 max-w-[500px] text-center text-lg leading-relaxed font-medium">
          Multi-page PDFs will be sequentially rasterized and reconciled for 100% geometric accuracy.
        </p>

        <div className="mt-12 flex items-center gap-10">
           <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
             <Lock className="w-3.5 h-3.5" /> SECURE AES-256
           </div>
           <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
             <FileText className="w-3.5 h-3.5" /> PDF 2.0 SUPPORT
           </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8">
         {[
           { label: 'Vision Pipeline', desc: 'Auto-extracts room schedule and envelope geometry.' },
           { label: 'Physics Simulation', desc: 'ACCA Manual J calculation with real-world orientation.' },
           { label: 'Market Grounding', desc: 'Real-time equipment availability and Manual S check.' }
         ].map((item, i) => (
           <div key={i} className="p-10 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm">
             <h4 className="text-[10px] font-black text-brand-600 uppercase tracking-widest mb-3">{item.label}</h4>
             <p className="text-sm font-bold text-slate-600 leading-relaxed">{item.desc}</p>
           </div>
         ))}
      </div>
    </div>
  );
};
