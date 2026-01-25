
import React from 'react';
import { ProjectState } from '../types';
import { TrendingUp, Award } from 'lucide-react';

interface ProcurementViewProps {
  project: ProjectState;
}

export const ProcurementView: React.FC<ProcurementViewProps> = ({ project }) => {
  const { heating, cooling } = project.selectedEquipment;

  return (
    <div className="max-w-7xl mx-auto animate-fade-in pb-20">
      <div className="mb-12 text-center">
        <h2 className="text-4xl font-black text-slate-900 tracking-tight">Specified Equipment</h2>
        <p className="text-slate-500 mt-2 text-lg">System selection based on Manual S logic.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
         {/* Cooling Card */}
         <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-10">
                 <TrendingUp className="w-32 h-32" />
             </div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Air Conditioner / Heat Pump</p>
             <h3 className="text-2xl font-black text-slate-900 mb-2">{cooling.make} {cooling.model}</h3>
             <div className="flex gap-2 mb-8">
                 <span className="px-3 py-1 bg-brand-50 text-brand-700 rounded-lg text-xs font-bold uppercase">{cooling.efficiencyRating}</span>
                 <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold uppercase">{Math.round(cooling.outputBTU/12000*2)/2} Ton</span>
             </div>
             <div className="space-y-2 text-sm text-slate-600">
                 <div className="flex justify-between"><span>Sensible Capacity:</span> <span className="font-mono font-bold">{cooling.sensibleBTU?.toLocaleString()} Btuh</span></div>
                 <div className="flex justify-between"><span>Latent Capacity:</span> <span className="font-mono font-bold">{cooling.latentBTU?.toLocaleString()} Btuh</span></div>
                 <div className="flex justify-between"><span>AHRI Reference:</span> <span className="font-mono font-bold">{cooling.ahriRef}</span></div>
             </div>
         </div>

         {/* Heating Card */}
         <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-10">
                 <Award className="w-32 h-32" />
             </div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Furnace / Air Handler</p>
             <h3 className="text-2xl font-black text-slate-900 mb-2">{heating.make} {heating.model}</h3>
             <div className="flex gap-2 mb-8">
                 <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold uppercase">{heating.efficiencyRating}</span>
                 <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold uppercase">{heating.airflowCFM} CFM</span>
             </div>
             <div className="space-y-2 text-sm text-slate-600">
                 <div className="flex justify-between"><span>Output Capacity:</span> <span className="font-mono font-bold">{heating.outputBTU?.toLocaleString()} Btuh</span></div>
                 <div className="flex justify-between"><span>Trade Name:</span> <span className="font-mono font-bold">{heating.trade}</span></div>
                 <div className="flex justify-between"><span>AHRI Reference:</span> <span className="font-mono font-bold">{heating.ahriRef}</span></div>
             </div>
         </div>
      </div>
    </div>
  );
};
