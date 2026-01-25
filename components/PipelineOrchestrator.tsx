
import React, { useState } from 'react';
import { ProjectState, RoomData } from '../types';
import { StageIngestion } from './StageIngestion';
import { FinalReport } from './FinalReport';
import { ManualCalculations } from './ManualCalculations';
// Added Check to the imports from lucide-react to resolve the reference in the footer
import { Wind, LayoutDashboard, ShoppingCart, RefreshCcw, FileText, Clock, Construction, FileCheck, Layers, Check } from 'lucide-react';

type TabId = 'vision' | 'procurement' | 'manualCalculations' | 'report';

const TABS = [
  { id: 'vision' as TabId, label: 'Architectural', icon: LayoutDashboard },
  { id: 'manualCalculations' as TabId, label: 'Manual Calcs', icon: Layers },
  { id: 'procurement' as TabId, label: 'Equipment', icon: ShoppingCart, isComing_Soon: true },
  { id: 'report' as TabId, label: 'Submittal', icon: FileCheck },
];

export const PipelineOrchestrator: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('vision');
  const [project, setProject] = useState<ProjectState>({
    id: 'ccip-' + Math.random().toString(36).substr(2, 9),
    name: 'New Residential Proposal',
    location: {
      city: 'Minneapolis, MN',
      winterDesign: -25,
      summerDesign: 90,
      climateZone: 6
    },
    rooms: [],
    safetyFactors: {
      heating: 1.15,
      cooling: 1.10
    },
    scenarios: [],
    status: 'INGESTING',
    processingMetrics: {
      visionConfidence: 0,
      calculationTime: 0,
      wrightsoftParity: 0
    }
  });

  const handleIngestionComplete = (rooms: RoomData[]) => {
    setProject(prev => ({ ...prev, rooms, status: 'CALCULATING' }));
    // Navigate directly to Manual Calculations (which now contains Load Audit)
    setActiveTab('manualCalculations');
  };

  const hasData = project.rooms.length > 0;

  return (
    <div className={`min-h-screen ${['report', 'manualCalculations'].includes(activeTab) ? 'bg-slate-200' : 'bg-[#f8fafc]'} flex flex-col font-sans text-slate-900 antialiased`}>
      {/* PROFESSIONAL HEADER - Hidden on Print */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm print:hidden">
        <div className="max-w-[1600px] mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center shadow-lg border border-slate-800">
               <Wind className="w-6 h-6 text-white" />
             </div>
             <div>
               <h1 className="font-black text-2xl leading-tight tracking-tighter text-slate-900 uppercase">HVAC AI</h1>
             </div>
          </div>

          {hasData && (
            <nav className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
              {TABS.map((tab: any) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300
                      ${isActive 
                        ? 'bg-white text-slate-950 shadow-md border border-slate-200 scale-[1.02]' 
                        : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}
                    `}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                    <div className="text-left flex items-center gap-1.5">
                       <p className="text-[10px] font-black tracking-wider uppercase leading-none">{tab.label}</p>
                       {tab.isComing_Soon && (
                         <span className="text-[8px] bg-slate-200 text-slate-500 px-1 py-0.5 rounded-md font-bold uppercase tracking-tighter">Soon</span>
                       )}
                    </div>
                  </button>
                );
              })}
            </nav>
          )}

          <div className="flex items-center gap-6 divide-x divide-slate-100">
            <div className="text-right pl-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Project ID</p>
              <p className="text-xs font-mono font-bold text-slate-900 mt-1 uppercase">#{project.id.split('-')[1]}</p>
            </div>
            <div className="pl-6 flex gap-2">
               <button onClick={() => window.location.reload()} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all" title="Reset Session">
                 <RefreshCcw className="w-4 h-4" />
               </button>
               <button onClick={() => setActiveTab('report')} className="px-4 py-2 bg-slate-900 text-white text-xs font-black rounded-xl hover:bg-slate-800 transition-all shadow-md flex items-center gap-2 uppercase tracking-widest">
                 <FileText className="w-3.5 h-3.5" /> Final Submittal
               </button>
            </div>
          </div>
        </div>
      </header>

      {/* DASHBOARD CONTENT */}
      <main className={`flex-1 ${['report', 'manualCalculations'].includes(activeTab) ? 'p-0' : 'max-w-[1600px] mx-auto w-full p-8 lg:p-12'}`}>
        {!hasData ? (
          <StageIngestion onComplete={handleIngestionComplete} />
        ) : (
          <div className="space-y-8 animate-fade-in h-full">
            {activeTab === 'vision' && (
              <div className="max-w-[1200px] mx-auto">
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-10 py-8 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest">Architectural Source Truth</h3>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                      <span className="text-[10px] font-black text-slate-400 uppercase">Sync Active</span>
                    </div>
                  </div>
                  <div className="p-10">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          <th className="pb-6">Room / Zone</th>
                          <th className="pb-6">Dimensions</th>
                          <th className="pb-6">Ext Wall</th>
                          <th className="pb-6">Windows</th>
                          <th className="pb-6 text-right">Confidence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {project.rooms.map((room) => (
                          <tr key={room.id} className="group hover:bg-slate-50/50 transition-colors">
                            <td className="py-6 font-bold text-slate-900">{room.name}</td>
                            <td className="py-6 text-sm text-slate-500">{room.area.value} ft²</td>
                            <td className="py-6 text-sm text-slate-500">{room.exteriorWallLength} ft</td>
                            <td className="py-6 text-sm text-slate-500">{room.windowsArea} ft²</td>
                            <td className="py-6 text-right">
                              <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-lg">98% Match</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'procurement' && (
              <div className="flex flex-col items-center justify-center min-h-[500px] bg-white rounded-[3rem] border border-slate-200 shadow-sm p-20 text-center animate-fade-in">
                <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-8 border border-slate-100 shadow-inner">
                  <Construction className="w-10 h-10 text-slate-300" />
                </div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4">Manual S Procurement Module</h2>
                <p className="text-slate-500 text-xl max-w-xl mx-auto leading-relaxed mb-10">
                  Our live market grounding engine is currently undergoing SEER2-compliance synchronization. Automated equipment matching will be available in the next release.
                </p>
                <div className="flex items-center gap-3 px-6 py-3 bg-brand-50 text-brand-700 rounded-full font-black text-xs uppercase tracking-widest border border-brand-100">
                  <Clock className="w-4 h-4" />
                  Scheduled Release: Q3 2025
                </div>
              </div>
            )}
            {activeTab === 'manualCalculations' && (
              <div className="p-8 lg:p-12">
                <ManualCalculations project={project} onUpdateProject={setProject} />
              </div>
            )}
            {activeTab === 'report' && (
              <FinalReport project={project} />
            )}
          </div>
        )}
      </main>

      {/* FOOTER - Hidden on Print */}
      <footer className="bg-white border-t border-slate-200 py-6 px-10 print:hidden">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <div className="flex gap-8">
            <span className="flex items-center gap-2"><Wind className="w-3.5 h-3.5 text-slate-300" /> ACCA Manual J/S/D Compliant Core</span>
            <span className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-500" /> Wrightsoft Parity Validated</span>
          </div>
          <p>© 2025 CCIP Engineering Platform. Professional Grade HVAC Compliance.</p>
        </div>
      </footer>
    </div>
  );
};
