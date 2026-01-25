
import React from 'react';
import { ProjectState } from '../../types';
import { ShieldCheck, TrendingUp, AlertCircle } from 'lucide-react';

interface ManualSViewProps {
  project: ProjectState;
}

export const ManualSView: React.FC<ManualSViewProps> = ({ project }) => {
  const { selectedEquipment, systemTotals } = project;
  
  // Basic compliance check logic purely for display
  const coolingRatio = selectedEquipment.cooling.outputBTU / systemTotals.totalCooling;
  const isCoolingCompliant = coolingRatio >= 0.95 && coolingRatio <= 1.25; // 115-125% typically
  
  const heatingRatio = selectedEquipment.heating.outputBTU / systemTotals.totalHeating;
  const isHeatingCompliant = heatingRatio >= 1.0 && heatingRatio <= 1.4;

  return (
    <div className="p-16 flex flex-col items-center justify-center space-y-12 animate-fade-in h-full">
       <div className={`p-10 rounded-[3rem] border-4 flex items-center gap-10 max-w-3xl w-full ${isCoolingCompliant ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center shadow-2xl ${isCoolingCompliant ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-amber-500 shadow-amber-500/30'}`}>
             <ShieldCheck className="w-12 h-12 text-white" />
          </div>
          <div className="flex-1">
             <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-2">Manual S Verification</h3>
             <p className={`text-sm font-bold uppercase tracking-widest ${isCoolingCompliant ? 'text-emerald-700' : 'text-amber-700'}`}>
               {isCoolingCompliant ? 'OPTIMAL' : 'CHECK SIZING'}: {isCoolingCompliant ? 'Equipment is within ACCA limits.' : 'Capacity deviation detected.'}
             </p>
          </div>
       </div>

       <div className="grid grid-cols-2 gap-8 w-full max-w-5xl">
            <div className="bg-white border p-10 rounded-[2.5rem] text-center space-y-4">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cooling Capacity Ratio</p>
               <p className="text-5xl font-mono font-black text-slate-900 tracking-tighter">{coolingRatio.toFixed(2)}x</p>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target: 0.95 - 1.15</p>
            </div>
            <div className="bg-white border p-10 rounded-[2.5rem] text-center space-y-4">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Heating Capacity Ratio</p>
               <p className="text-5xl font-mono font-black text-slate-900 tracking-tighter">{heatingRatio.toFixed(2)}x</p>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target: 1.00 - 1.40</p>
            </div>
       </div>
    </div>
  );
};
