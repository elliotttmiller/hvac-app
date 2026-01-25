
import React from 'react';
import { Wind, RefreshCcw } from 'lucide-react';

interface HeaderProps {
  jobId?: string;
  onReset?: () => void;
  centerContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  title?: string; // Fallback legacy prop
}

export const Header: React.FC<HeaderProps> = ({ jobId, onReset, centerContent, rightContent, title }) => {
  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 transition-all duration-300 print:hidden h-24">
      <div className="max-w-[1800px] mx-auto px-6 h-full flex items-center justify-between relative">
        
        {/* LEFT: BRANDING */}
        <div className="flex items-center gap-4 min-w-[200px]">
           <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center shadow-lg border border-slate-800 shrink-0">
             <Wind className="w-5 h-5 text-white" />
           </div>
           <div className="hidden md:block">
             <h1 className="font-black text-xl tracking-tighter text-slate-900 uppercase leading-none">HVAC AI</h1>
             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Engine v2.5</p>
           </div>
        </div>

        {/* CENTER: CUSTOM CONTENT OR TITLE */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center w-full max-w-xl pointer-events-none">
          <div className="pointer-events-auto">
            {centerContent ? (
              centerContent
            ) : title ? (
              <div className="px-6 py-2 bg-slate-50 rounded-full border border-slate-200 shadow-sm">
                 <span className="text-xs font-bold text-slate-700">{title}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* RIGHT: ACTIONS OR JOB INFO */}
        <div className="flex items-center gap-4 min-w-[200px] justify-end">
          {rightContent ? (
            rightContent
          ) : jobId ? (
            <div className="flex items-center gap-6 divide-x divide-slate-100">
              <div className="text-right pl-6">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Job ID</p>
                <p className="text-xs font-mono font-bold text-slate-900 mt-1 uppercase">#{jobId.split('-')[1]}</p>
              </div>
              {onReset && (
                <div className="pl-6">
                   <button onClick={onReset} className="p-2.5 bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all">
                     <RefreshCcw className="w-4 h-4" />
                   </button>
                </div>
              )}
            </div>
          ) : null}
        </div>

      </div>
    </header>
  );
};
