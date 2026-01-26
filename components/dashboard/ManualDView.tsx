// components/dashboard/ManualDView.tsx

import React from 'react';
import { ManualDResult } from '../../types';
import { Zap, Ruler, Layers, Fan, Check } from 'lucide-react';

interface ManualDViewProps {
  manualD?: ManualDResult;
}

export const ManualDView: React.FC<ManualDViewProps> = ({ manualD }) => {
  if (!manualD) return (
    <div className="p-16 flex items-center justify-center text-slate-400">
      <p className="font-bold uppercase tracking-widest text-xs">Duct Design Pending...</p>
    </div>
  );

  return (
    <div className="p-16 space-y-12 animate-fade-in h-full overflow-y-auto">
      <div className="grid grid-cols-4 gap-8">
         {[
           { label: 'Available Static', val: '0.50 IWC', icon: Zap },
           { label: 'Effective Length', val: '250 FT', icon: Ruler },
           { label: 'Friction Rate', val: manualD.frictionRate ?? '0.00', icon: Layers },
           { label: 'System CFM', val: manualD.totalCFM ?? 0, icon: Fan }
         ].map((item, i) => (
           <div key={i} className="p-8 bg-slate-50 rounded-[2rem] border text-center flex flex-col items-center">
              <item.icon className="w-6 h-6 text-brand-600 mb-4" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
              <p className="text-3xl font-black text-slate-900 font-mono tracking-tight">{item.val}</p>
           </div>
         ))}
      </div>

      <div className="bg-white rounded-[2.5rem] border overflow-hidden shadow-sm">
         <div className="px-10 py-6 bg-slate-50 border-b">
            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Duct Sizing Schedule (ACCA MANUAL D)</h4>
         </div>
         <table className="w-full">
           <thead>
             <tr className="text-right text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
               <th className="px-10 py-6 text-left">Branch Name</th>
               <th className="px-10 py-6">CFM</th>
               <th className="px-10 py-6">Duct Dia (in)</th>
               <th className="px-10 py-6">Velocity (FPM)</th>
               <th className="px-10 py-6 text-center">Audit</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-slate-100">
             {(manualD.branches ?? []).map((branch, i) => (
               <tr key={branch.name || i} className="text-right hover:bg-slate-50 transition-colors">
                 <td className="px-10 py-6 text-left font-black text-slate-900 uppercase">{branch.name || 'Unknown'}</td>
                 <td className="px-10 py-6 font-mono font-bold text-brand-600">{branch.cfm ?? 0}</td>
                 <td className="px-10 py-6 font-mono font-black">{branch.roundSize ?? 0}" Ø</td>
                 <td className="px-10 py-6 font-mono">{Math.round(branch.velocity ?? 0)}</td>
                 <td className="px-10 py-6 text-center">
                   <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
      </div>
    </div>
  );
};