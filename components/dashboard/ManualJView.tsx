// components/dashboard/ManualJView.tsx

import React from 'react';
import { ProjectState, Room } from '../../types';

// --- INTERNAL COMPONENT: LiveAuditPanel ---
interface LiveAuditPanelProps {
  project: ProjectState;
}

const LiveAuditPanel: React.FC<LiveAuditPanelProps> = ({ project }) => {
  const { systemTotals, designConditions } = project;

  return (
    <div className="col-span-4 p-12 bg-slate-50 border-r space-y-12">
       <div className="space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Load Audit</p>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">PEAK RESIDENTIAL GAIN</h3>
       </div>

       <div className="space-y-10">
         <div>
           <p className="text-[10px] text-slate-400 font-black uppercase mb-1 tracking-widest">Cooling Load</p>
           <p className="text-6xl font-mono font-black text-slate-900 tracking-tighter">
             {Math.round(systemTotals?.totalCooling || 0).toLocaleString()}
             <span className="text-xl text-slate-300 ml-2">BTUH</span>
           </p>
         </div>
         <div>
           <p className="text-[10px] text-slate-400 font-black uppercase mb-1 tracking-widest">Heating Load</p>
           <p className="text-6xl font-mono font-black text-slate-900 tracking-tighter">
             {Math.round(systemTotals?.totalHeating || 0).toLocaleString()}
             <span className="text-xl text-slate-300 ml-2">BTUH</span>
           </p>
         </div>
       </div>

       <div className="pt-10 border-t border-slate-200">
          <div className="flex items-center justify-between mb-4">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Moisture Diff</span>
             <span className="text-sm font-mono font-black">{designConditions?.moistureDiff ?? 0} GR/LB</span>
          </div>
          <div className="flex items-center justify-between">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Daily Range</span>
             <span className="text-sm font-mono font-black">
               {designConditions?.cooling?.dailyRange === 'M' ? 'MEDIUM (M)' : (designConditions?.cooling?.dailyRange || '-')}
             </span>
          </div>
       </div>
    </div>
  );
};

// --- INTERNAL COMPONENT: LoadLedgerTable ---
interface LoadLedgerTableProps {
  rooms: ReadonlyArray<Room>;
}

const LoadLedgerTable: React.FC<LoadLedgerTableProps> = ({ rooms }) => {
  return (
    <div className="col-span-8 flex flex-col">
      <div className="px-10 py-8 border-b bg-white flex justify-between items-center">
         <h4 className="font-black text-sm uppercase tracking-widest text-slate-900">Manual J Room Ledger</h4>
      </div>
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full">
          <thead className="bg-slate-50 border-b sticky top-0">
            <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              <th className="px-10 py-6 text-left">Room / Zone</th>
              <th className="px-10 py-6 text-right">Htg Btuh</th>
              <th className="px-10 py-6 text-right">Clg Btuh</th>
              <th className="px-10 py-6 text-right">Htg AVF</th>
              <th className="px-10 py-6 text-right">Clg AVF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(rooms || []).map((room, i) => (
              <tr key={room.id || i} className="hover:bg-slate-50 transition-colors">
                <td className="px-10 py-6 font-bold text-slate-900 uppercase">{room.name}</td>
                <td className="px-10 py-6 text-right font-mono font-bold text-amber-600">{Math.round(room.calculationResult?.heatingLoad || 0)}</td>
                <td className="px-10 py-6 text-right font-mono font-bold text-brand-600">{Math.round(room.calculationResult?.coolingLoad || 0)}</td>
                <td className="px-10 py-6 text-right font-mono text-slate-400">{Math.round(room.calculationResult?.heatingCFM || 0)}</td>
                <td className="px-10 py-6 text-right font-mono font-black text-slate-900">{Math.round(room.calculationResult?.coolingCFM || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- MAIN EXPORTED VIEW ---
interface ManualJViewProps {
  project: ProjectState;
}

export const ManualJView: React.FC<ManualJViewProps> = ({ project }) => {
  return (
    <div className="grid grid-cols-12 h-full flex-1">
      <LiveAuditPanel project={project} />
      <LoadLedgerTable rooms={project.rooms} />
    </div>
  );
};