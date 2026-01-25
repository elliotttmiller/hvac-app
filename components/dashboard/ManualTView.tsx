
import React from 'react';
import { ManualTResult } from '../../types';

interface ManualTViewProps {
  manualT?: ManualTResult;
}

export const ManualTView: React.FC<ManualTViewProps> = ({ manualT }) => {
  if (!manualT) return null;

  return (
    <div className="p-16 grid grid-cols-3 gap-8 animate-fade-in h-full overflow-auto custom-scrollbar">
       {manualT.terminals.map(terminal => (
         <div key={terminal.roomName} className="p-10 bg-white border-2 border-slate-100 rounded-[2.5rem] flex flex-col">
            <div className="flex justify-between items-start mb-10">
              <h5 className="font-black text-slate-900 text-lg uppercase tracking-tighter leading-none">{terminal.roomName}</h5>
              <span className="px-3 py-1 bg-slate-900 text-white text-[9px] font-black rounded-full uppercase tracking-widest">{terminal.registerCount} Regs</span>
            </div>
            <div className="space-y-6 flex-1">
               <div className="flex justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Throw</span>
                  <span className="text-xl font-mono font-black">{terminal.estimatedThrow} FT</span>
               </div>
               <div className="flex justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Velocity</span>
                  <span className="text-xl font-mono font-black text-brand-600">{terminal.velocityFPM} FPM</span>
               </div>
               <div className="flex justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CFM / Dev</span>
                  <span className="text-xl font-mono font-black">{terminal.cfmPerRegister}</span>
               </div>
            </div>
            <div className="mt-10 pt-8 border-t flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
               <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Acoustic Pass</span>
            </div>
         </div>
       ))}
    </div>
  );
};
