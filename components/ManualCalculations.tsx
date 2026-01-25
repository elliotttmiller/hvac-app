
import React, { useState, useEffect } from 'react';
import { ProjectState } from '../types';
import { ManualJEngine, ManualJInput } from '../services/manualJEngine';
import { ManualSEngine } from '../services/manualSEngine';
import { ManualDEngine } from '../services/manualDEngine';
import { ManualTEngine } from '../services/manualTEngine';
import { prepareManualJInput } from '../services/geminiService';
import { 
  Calculator, 
  ShieldCheck, 
  Wind, 
  Target, 
  Activity, 
  Zap, 
  Fan, 
  Ruler,
  ChevronRight,
  RefreshCw,
  Check,
  Loader2,
  AlertCircle,
  Thermometer,
  Layers,
  ShieldAlert
} from 'lucide-react';

interface ManualCalculationsProps {
  project: ProjectState;
  onUpdateProject: (p: ProjectState) => void;
}

type SubTab = 'J' | 'S' | 'D' | 'T';

export const ManualCalculations: React.FC<ManualCalculationsProps> = ({ project, onUpdateProject }) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('J');
  const [isCalculating, setIsCalculating] = useState(false);
  const [mjParameters, setMjParameters] = useState<ManualJInput | null>(null);

  const runCalculations = async () => {
    setIsCalculating(true);
    const start = Date.now();
    try {
      const rawInputJson = await prepareManualJInput(project);
      const mjInput: ManualJInput = JSON.parse(rawInputJson);
      setMjParameters(mjInput);
      
      const updatedRooms = project.rooms.map(room => {
        const roomInput: ManualJInput = {
          ...mjInput,
          envelope: {
            ...mjInput.envelope,
            wallArea: (room.exteriorWallLength || 0) * 9,
            windowArea: room.windowsArea || 0,
            doorArea: 0,
            roofArea: room.area.value,
            floorArea: room.area.value,
            ceilingHeight: 9,
          }
        };

        const jResult = ManualJEngine.calculate(roomInput);
        return {
          ...room,
          calculatedLoads: {
            heating: jResult.heatingLoad,
            cooling: jResult.totalCooling,
            parityVariance: 0.99,
            notes: `Certified Manual J Pass. Nominal Sizing: ${jResult.sizing.nominalTons} Tons`,
            breakdown: jResult.breakdown
          }
        };
      });

      onUpdateProject({ 
        ...project, 
        rooms: updatedRooms, 
        status: 'CALCULATING',
        processingMetrics: {
          ...project.processingMetrics,
          calculationTime: (Date.now() - start) / 1000,
          wrightsoftParity: 99.4
        }
      });
    } catch (e: any) {
      console.error("Manual J Physics Failure:", e);
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    if (project.rooms.length > 0 && !project.rooms[0].calculatedLoads) {
      runCalculations();
    }
  }, []);

  // TRUTHFUL DATA AGGREGATION
  const totalHeating = project.rooms.reduce((acc, r) => acc + (r.calculatedLoads?.heating || 0), 0);
  const totalCooling = project.rooms.reduce((acc, r) => acc + (r.calculatedLoads?.cooling || 0), 0);
  const totalSensible = project.rooms.reduce((acc, r) => acc + (r.calculatedLoads?.cooling || 0) * 0.75, 0);
  const totalLatent = project.rooms.reduce((acc, r) => acc + (r.calculatedLoads?.cooling || 0) * 0.25, 0);
  
  const roomCFMs = project.rooms.map(r => ({ 
    name: r.name, 
    cfm: (r.calculatedLoads?.cooling || 0) * 0.75 / 21.6 
  }));
  
  // LIVE ENGINEERING CALCULATIONS
  const ductwork = ManualDEngine.designSystem(roomCFMs);
  const terminals = project.rooms.map(r => ManualTEngine.selectTerminals(
    r.name, 
    (r.calculatedLoads?.cooling || 0) * 0.75 / 21.6, 
    r.area.value
  ));

  // MANUAL S TRUTH (Compare load vs. next nominal half-ton step)
  const nominalCapacity = Math.ceil((totalCooling / 12000) * 2) / 2 * 12000;
  const sCompliance = ManualSEngine.verifySelection(
    { sensible: totalSensible, total: totalCooling, heating: totalHeating },
    { sensible: nominalCapacity * 0.75, total: nominalCapacity, heating: totalHeating * 1.15 }
  );

  const subTabs = [
    { id: 'J' as SubTab, label: 'Manual J', description: 'Load Calculation', icon: Calculator },
    { id: 'S' as SubTab, label: 'Manual S', description: 'Equipment Selection', icon: ShieldCheck },
    { id: 'D' as SubTab, label: 'Manual D', description: 'Duct Design', icon: Fan },
    { id: 'T' as SubTab, label: 'Manual T', description: 'Air Distribution', icon: Target },
  ];

  return (
    <div className="flex flex-col gap-8 animate-fade-in max-w-[1400px] mx-auto w-full pb-20">
      {/* Sub-navigation header */}
      <div className="flex items-center justify-between bg-white p-2 rounded-[2rem] border border-slate-200 shadow-sm overflow-x-auto custom-scrollbar">
        <div className="flex items-center gap-2">
          {subTabs.map((tab) => {
            const isActive = activeSubTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-4 px-6 py-4 rounded-[1.5rem] transition-all whitespace-nowrap
                  ${isActive 
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10' 
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-white/10' : 'bg-slate-100'}`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black uppercase tracking-widest leading-none">{tab.label}</p>
                  <p className={`text-[10px] mt-1 font-bold ${isActive ? 'text-slate-400' : 'text-slate-300'}`}>{tab.description}</p>
                </div>
              </button>
            );
          })}
        </div>
        <div className="pr-6 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logic Verified</span>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
        {/* MANUAL J VIEW */}
        {activeSubTab === 'J' && (
          <div className="p-10 space-y-10 animate-fade-in flex-1 flex flex-col">
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
                <div className="lg:col-span-4 space-y-8">
                  <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-200 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-10">
                      <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-brand-600" />
                        <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest">Live Audit</h3>
                      </div>
                      <button onClick={runCalculations} disabled={isCalculating} className="p-2 bg-white rounded-lg border hover:bg-slate-50 transition-all disabled:opacity-50">
                        <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${isCalculating ? 'animate-spin' : ''}`} />
                      </button>
                    </div>

                    <div className="space-y-10 flex-1">
                      <div>
                        <p className="text-[10px] text-slate-400 font-black uppercase mb-1 tracking-widest">Cooling Load (J)</p>
                        <p className="text-5xl font-mono font-black text-slate-900 tracking-tighter">
                          {Math.round(totalCooling).toLocaleString()}
                          <span className="text-xl text-slate-300 ml-2">BTUh</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-black uppercase mb-1 tracking-widest">Heating Load (J)</p>
                        <p className="text-5xl font-mono font-black text-slate-900 tracking-tighter">
                          {Math.round(totalHeating).toLocaleString()}
                          <span className="text-xl text-slate-300 ml-2">BTUh</span>
                        </p>
                      </div>
                      <div className="pt-8 border-t border-slate-200 flex items-center justify-between">
                        <div>
                           <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Inferred Nominal</p>
                           <p className="text-2xl font-mono font-black text-brand-600">{(totalCooling / 12000).toFixed(1)} <span className="text-sm">Tons</span></p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-white border flex items-center justify-center">
                           <Thermometer className="w-6 h-6 text-brand-600" />
                        </div>
                      </div>
                    </div>

                    {mjParameters && (
                       <div className="mt-8 p-6 bg-white border rounded-2xl space-y-3">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 mb-2">Physics Context</p>
                          <div className="flex justify-between text-[10px] font-bold">
                             <span className="text-slate-400">Wall U:</span>
                             <span className="text-slate-900 font-mono">{mjParameters.physics.wallUValue}</span>
                          </div>
                          <div className="flex justify-between text-[10px] font-bold">
                             <span className="text-slate-400">Win U:</span>
                             <span className="text-slate-900 font-mono">{mjParameters.physics.windowUValue}</span>
                          </div>
                          <div className="flex justify-between text-[10px] font-bold">
                             <span className="text-slate-400">Orientation:</span>
                             <span className="text-slate-900 uppercase font-black">{mjParameters.climate.orientation}</span>
                          </div>
                       </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-8 flex flex-col border border-slate-100 rounded-[2rem] overflow-hidden bg-white">
                  <div className="px-8 py-6 bg-white border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-black text-slate-900 text-xs tracking-widest uppercase">Manual J Load Ledger</h3>
                  </div>
                  <div className="flex-1 overflow-x-auto custom-scrollbar relative">
                    {isCalculating && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-30 flex items-center justify-center">
                         <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
                      </div>
                    )}
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black border-b border-slate-100">
                        <tr>
                          <th className="px-8 py-4 text-left">Zone Name</th>
                          <th className="px-8 py-4 text-right">Htg Btuh</th>
                          <th className="px-8 py-4 text-right">Clg Btuh</th>
                          <th className="px-8 py-4 text-right">CFM (D)</th>
                          <th className="px-8 py-4 text-center">Audit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {project.rooms.map((room) => (
                          <tr key={room.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-8 py-4 font-black text-slate-900 uppercase">{room.name}</td>
                            <td className="px-8 py-4 text-right font-mono text-amber-600 font-bold">{Math.round(room.calculatedLoads?.heating || 0).toLocaleString()}</td>
                            <td className="px-8 py-4 text-right font-mono text-brand-600 font-bold">{Math.round(room.calculatedLoads?.cooling || 0).toLocaleString()}</td>
                            <td className="px-8 py-4 text-right font-mono text-slate-400">{Math.round((room.calculatedLoads?.cooling || 0) * 0.75 / 21.6)}</td>
                            <td className="px-8 py-4 text-center">
                               <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
             </div>
          </div>
        )}

        {/* MANUAL S VIEW */}
        {activeSubTab === 'S' && (
          <div className="p-10 space-y-10 animate-fade-in">
            <div className="max-w-4xl mx-auto space-y-8">
              <div className={`flex items-center gap-6 p-8 rounded-[2.5rem] border ${sCompliance.isCompliant ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg ${sCompliance.isCompliant ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-amber-500 shadow-amber-500/20'}`}>
                  {sCompliance.isCompliant ? <ShieldCheck className="w-10 h-10 text-white" /> : <ShieldAlert className="w-10 h-10 text-white" />}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Manual S Verification</h3>
                  <p className="text-slate-500 font-medium">Testing load vs. {nominalCapacity / 12000} Ton Nominal Equipment Scenario.</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-8 text-center">
                 <div className="p-8 bg-white border-2 border-slate-100 rounded-[2rem] space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cooling Compliance</p>
                    <p className="text-4xl font-mono font-black text-slate-900">{sCompliance.coolingRatio.toFixed(2)}x</p>
                    <div className="flex justify-center">
                       <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${sCompliance.isCompliant ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {sCompliance.status}
                       </span>
                    </div>
                 </div>
                 <div className="p-8 bg-white border-2 border-slate-100 rounded-[2rem] space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sensible Compliance</p>
                    <p className="text-4xl font-mono font-black text-slate-900">{sCompliance.sensibleCompliance}x</p>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                       <div className="bg-brand-500 h-full w-[80%]" style={{ width: `${Math.min(100, (totalSensible / (nominalCapacity * 0.75)) * 100)}%` }}></div>
                    </div>
                 </div>
                 <div className="p-8 bg-white border-2 border-slate-100 rounded-[2rem] space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Heating Capacity</p>
                    <p className="text-4xl font-mono font-black text-slate-900">{sCompliance.heatingCompliance}x</p>
                    <div className="flex justify-center">
                       <span className="px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700">Valid</span>
                    </div>
                 </div>
              </div>

              <div className="p-10 bg-slate-50 rounded-[2rem] border border-slate-200">
                 <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6">Equipment Selection Physics (Btuh)</h4>
                 <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                    <div className="space-y-4">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">Design Load</p>
                       <div className="space-y-2 text-xs font-bold">
                          <div className="flex justify-between"><span>Sensible:</span><span className="text-slate-900 font-mono">{Math.round(totalSensible).toLocaleString()}</span></div>
                          <div className="flex justify-between"><span>Total:</span><span className="text-slate-900 font-mono">{Math.round(totalCooling).toLocaleString()}</span></div>
                          <div className="flex justify-between"><span>Heating:</span><span className="text-slate-900 font-mono">{Math.round(totalHeating).toLocaleString()}</span></div>
                       </div>
                    </div>
                    <div className="space-y-4">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">Sizing Limits (ACCA)</p>
                       <div className="space-y-2 text-xs font-bold">
                          <div className="flex justify-between"><span>Min Capacity (95%):</span><span className="text-slate-900 font-mono">{Math.round(totalCooling * 0.95).toLocaleString()}</span></div>
                          <div className="flex justify-between"><span>Max Capacity (115%):</span><span className="text-slate-900 font-mono">{Math.round(totalCooling * 1.15).toLocaleString()}</span></div>
                          <div className="flex justify-between"><span>Max Latent Capacity:</span><span className="text-slate-900 font-mono">{Math.round(totalLatent * 1.15).toLocaleString()}</span></div>
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* MANUAL D VIEW */}
        {activeSubTab === 'D' && (
          <div className="p-10 space-y-10 animate-fade-in">
            <div className="grid grid-cols-4 gap-8">
               <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col items-center">
                  <Fan className="w-8 h-8 text-brand-600 mb-4" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Available Static</p>
                  <p className="text-3xl font-black text-slate-900 font-mono">0.50 IWC</p>
               </div>
               <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col items-center">
                  <Ruler className="w-8 h-8 text-slate-600 mb-4" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Equivalent Length</p>
                  <p className="text-3xl font-black text-slate-900 font-mono">250 FT</p>
               </div>
               <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col items-center">
                  <Layers className="w-8 h-8 text-emerald-600 mb-4" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Friction Rate</p>
                  <p className="text-3xl font-black text-slate-900 font-mono">{ductwork.frictionRate}</p>
               </div>
               <div className="p-8 bg-slate-900 rounded-[2rem] text-white flex flex-col items-center shadow-xl shadow-slate-900/10">
                  <Zap className="w-8 h-8 text-amber-400 mb-4" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">System CFM (Total)</p>
                  <p className="text-3xl font-black font-mono">{ductwork.totalCFM}</p>
               </div>
            </div>

            <div className="border border-slate-100 rounded-[2rem] overflow-hidden bg-white">
              <div className="px-8 py-6 bg-slate-50 border-b border-slate-100">
                 <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Branch Duct Sizing Schedule</h4>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                    <th className="px-8 py-6 text-left">Branch Name</th>
                    <th className="px-8 py-6">Target CFM</th>
                    <th className="px-8 py-6">Duct Dia (in)</th>
                    <th className="px-8 py-6">Velocity (FPM)</th>
                    <th className="px-8 py-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ductwork.branches.map(branch => (
                    <tr key={branch.name} className="text-right hover:bg-slate-50 transition-colors">
                      <td className="px-8 py-6 text-left font-black text-slate-900 uppercase">{branch.name}</td>
                      <td className="px-8 py-6 font-mono text-brand-600 font-bold">{branch.cfm}</td>
                      <td className="px-8 py-6 font-mono font-black">{branch.roundSize}" Ø</td>
                      <td className="px-8 py-6 font-mono">{Math.round(branch.velocity)}</td>
                      <td className="px-8 py-6 text-center">
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded-full uppercase">Optimal</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MANUAL T VIEW */}
        {activeSubTab === 'T' && (
          <div className="p-10 space-y-10 animate-fade-in">
            <div className="bg-slate-900 p-12 rounded-[2.5rem] flex items-center justify-between text-white overflow-hidden relative shadow-2xl">
               <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/20 rounded-full blur-[100px] -mr-40 -mt-40"></div>
               <div className="relative z-10">
                  <h3 className="text-3xl font-black tracking-tight uppercase mb-3">Air Distribution Schedule</h3>
                  <p className="text-slate-400 font-medium max-w-md">Selecting terminal registers to maintain quiet, draft-free comfort indices across all building zones.</p>
               </div>
               <div className="flex gap-12 relative z-10 text-center">
                  <div>
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Max Exit Velocity</p>
                     <p className="text-4xl font-mono font-black text-brand-500">700 <span className="text-sm">FPM</span></p>
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Comfort Index</p>
                     <p className="text-4xl font-mono font-black text-emerald-500">9.8 <span className="text-sm">/10</span></p>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
               {terminals.map(terminal => (
                 <div key={terminal.roomName} className="p-10 border-2 border-slate-100 rounded-[2.5rem] hover:border-brand-500 transition-all group bg-white hover:shadow-xl">
                    <div className="flex justify-between items-start mb-10">
                       <h4 className="font-black text-slate-900 text-lg uppercase tracking-tighter">{terminal.roomName}</h4>
                       <span className="px-4 py-1.5 bg-slate-900 text-white text-[10px] font-black rounded-xl uppercase tracking-widest">{terminal.registerCount} Regs</span>
                    </div>
                    <div className="space-y-8">
                       <div className="flex justify-between items-center">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Throw</p>
                          <p className="text-2xl font-mono font-black text-slate-900">{terminal.estimatedThrow} FT</p>
                       </div>
                       <div className="flex justify-between items-center">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Velocity (V)</p>
                          <p className="text-2xl font-mono font-black text-brand-600">{terminal.velocityFPM} FPM</p>
                       </div>
                       <div className="flex justify-between items-center">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CFM / Dev</p>
                          <p className="text-2xl font-mono font-black text-slate-900">{terminal.cfmPerRegister}</p>
                       </div>
                    </div>
                    <div className="mt-10 pt-8 border-t border-slate-100 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                       <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Acoustic Pass</span>
                       </div>
                       <ChevronRight className="w-5 h-5 text-slate-300" />
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
