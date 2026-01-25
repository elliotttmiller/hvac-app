
import React, { useState } from 'react';
import { ProjectState } from '../../types';
import { LayoutDashboard, Layers, ShoppingCart, FileCheck, CheckCircle2, Ruler, Wind, MapPin } from 'lucide-react';
import { ManualJView } from './ManualJView';
import { ManualSView } from './ManualSView';
import { ProcurementView } from '../ProcurementView';
import { FinalReport } from '../FinalReport';
import { Calculator, ShieldCheck, Check } from 'lucide-react';

interface EngineeringDashboardProps {
  project: ProjectState;
}

type TabId = 'arch' | 'calcs' | 'proc' | 'report';
type SubTab = 'J' | 'S';

export const EngineeringDashboard: React.FC<EngineeringDashboardProps> = ({ project }) => {
  const [activeTab, setActiveTab] = useState<TabId>('calcs');
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('J');

  const navItems = [
    { id: 'arch' as TabId, label: 'Architectural', icon: LayoutDashboard },
    { id: 'calcs' as TabId, label: 'Manual Calcs', icon: Layers },
    { id: 'proc' as TabId, label: 'Equipment Match', icon: ShoppingCart },
    { id: 'report' as TabId, label: 'Submittal Set', icon: FileCheck },
  ];

  const subTabs = [
    { id: 'J' as SubTab, label: 'Manual J', description: 'Load Calculation', icon: Calculator },
    { id: 'S' as SubTab, label: 'Manual S', description: 'Equipment Sizing', icon: ShieldCheck },
  ];

  const totalArea = project.rooms.reduce((acc, r) => acc + r.area, 0);

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-20 z-40">
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 px-6 py-3 rounded-xl transition-all ${isActive ? 'bg-white text-slate-950 shadow-md border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : ''}`} />
                <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
              </button>
            );
          })}
        </div>
        
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
             <CheckCircle2 className="w-4 h-4" />
             <span className="text-[10px] font-black uppercase tracking-widest">Logic Certified</span>
           </div>
        </div>
      </div>

      <div className="flex-1 p-8 lg:p-12">
        {activeTab === 'arch' && (
          <div className="max-w-6xl mx-auto space-y-12 animate-fade-in">
             <div className="grid grid-cols-3 gap-8">
               <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
                  <Ruler className="w-6 h-6 text-slate-400 mb-4" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Envelope</p>
                  <p className="text-4xl font-mono font-black text-slate-900">{Math.round(totalArea)} <span className="text-sm">SQ FT</span></p>
               </div>
               <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
                  <Wind className="w-6 h-6 text-slate-400 mb-4" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Design Condition</p>
                  <p className="text-2xl font-black text-slate-900 leading-none">{project.designConditions.heating.outdoorDB}°F / {project.designConditions.cooling.outdoorDB}°F</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase mt-2">Minneapolis, MN</p>
               </div>
               <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
                  <MapPin className="w-6 h-6 text-slate-400 mb-4" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Oriented Loads</p>
                  <p className="text-4xl font-mono font-black text-slate-900">{project.advancedSimulations.multiOrientation.length} <span className="text-sm">VECTORS</span></p>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'calcs' && (
          <div className="flex flex-col gap-8 animate-fade-in max-w-[1400px] mx-auto w-full pb-20">
             <div className="flex items-center justify-between bg-white p-2 rounded-[2.5rem] border shadow-sm">
                <div className="flex items-center gap-2">
                  {subTabs.map((tab) => {
                    const isActive = activeSubTab === tab.id;
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id)}
                        className={`flex items-center gap-4 px-8 py-5 rounded-[2rem] transition-all whitespace-nowrap
                          ${isActive 
                            ? 'bg-slate-900 text-white shadow-xl scale-105' 
                            : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <div className="text-left">
                          <p className="text-xs font-black uppercase tracking-widest leading-none">{tab.label}</p>
                          <p className={`text-[10px] mt-1 font-bold ${isActive ? 'text-slate-400' : 'text-slate-300'}`}>{tab.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="pr-10 flex items-center gap-3">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Engineering Snapshot</span>
                </div>
              </div>

              <div className="bg-white rounded-[3rem] border shadow-sm min-h-[700px] flex flex-col overflow-hidden">
                {activeSubTab === 'J' && <ManualJView project={project} />}
                {activeSubTab === 'S' && <ManualSView project={project} />}
              </div>
          </div>
        )}

        {activeTab === 'proc' && (
          <ProcurementView project={project} />
        )}

        {activeTab === 'report' && (
          <FinalReport project={project} />
        )}
      </div>
    </div>
  );
};
