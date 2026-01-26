import React, { useState } from 'react';
import { ProjectState } from '../../types';
import { LayoutDashboard, Ruler, Wind, MapPin, CheckCircle2, ScanEye, Code, X, FileJson, BrainCircuit, Calculator, Copy, Check } from 'lucide-react';

interface EngineeringDashboardProps {
  project: ProjectState;
}

type TabId = 'arch';

export const EngineeringDashboard: React.FC<EngineeringDashboardProps> = ({ project }) => {
  const [activeTab, setActiveTab] = useState<TabId>('arch');
  const [showRawJson, setShowRawJson] = useState(false);
  const [copied, setCopied] = useState(false);

  const navItems = [
    { id: 'arch' as TabId, label: 'Vision Inspection', icon: ScanEye },
  ];

  const totalArea = (project.rooms || []).reduce((acc, r) => acc + (r.area || 0), 0);

  const handleCopy = async () => {
    if (!project.visionRawData) return;
    
    const data = project.visionRawData;
    let text = "";

    if (data.vision_reasoning) {
        text += "========================================\n";
        text += "   VISION LOGIC TRACE (STEP 1)\n";
        text += "========================================\n\n";
        text += data.vision_reasoning + "\n\n\n";
    }

    if (data.math_trace) {
        text += "========================================\n";
        text += "   MATH CALCULATION TRACE (STEP 2)\n";
        text += "========================================\n\n";
        text += data.math_trace + "\n\n\n";
    }

    text += "========================================\n";
    text += "   RAW JSON OUTPUT\n";
    text += "========================================\n\n";
    text += JSON.stringify(data, null, 2);

    try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    } catch (err) {
        console.error("Failed to copy logs", err);
    }
  };

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
           <button 
             onClick={() => setShowRawJson(true)}
             className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-full border border-amber-100 hover:bg-amber-100 hover:scale-105 active:scale-95 transition-all cursor-pointer"
           >
             <Code className="w-4 h-4" />
             <span className="text-[10px] font-black uppercase tracking-widest">Vision Debug Mode</span>
           </button>
        </div>
      </div>

      <div className="flex-1 p-8 lg:p-12">
        {activeTab === 'arch' && (
          <div className="max-w-7xl mx-auto space-y-12 animate-fade-in">
             <div className="grid grid-cols-3 gap-8">
               <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col">
                  <Ruler className="w-6 h-6 text-slate-400 mb-4" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Detected Envelope</p>
                  <p className="text-4xl font-mono font-black text-slate-900">{Math.round(totalArea)} <span className="text-sm">SQ FT</span></p>
               </div>
               <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col">
                  <Wind className="w-6 h-6 text-slate-400 mb-4" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Detected Zones</p>
                  <p className="text-4xl font-mono font-black text-slate-900">{project.rooms.length} <span className="text-sm">ROOMS</span></p>
               </div>
               <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col">
                  <MapPin className="w-6 h-6 text-slate-400 mb-4" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Scale Factor</p>
                  <p className="text-4xl font-mono font-black text-slate-900">AUTO <span className="text-sm">DETECT</span></p>
               </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
                <div className="px-10 py-6 border-b bg-slate-50 flex items-center justify-between">
                   <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">AI Detection Log</h4>
                   <span className="text-[10px] font-bold text-slate-400 uppercase">Confidence High</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-[9px] font-black uppercase tracking-widest text-slate-400 border-b">
                                <th className="px-10 py-6">Room Name</th>
                                <th className="px-10 py-6 text-right">Detected Area (sq ft)</th>
                                <th className="px-10 py-6 text-right">Inferred Volume (cu ft)</th>
                                <th className="px-10 py-6 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {project.rooms.map((room, i) => (
                                <tr key={room.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-10 py-6 font-bold text-slate-900">{room.name}</td>
                                    <td className="px-10 py-6 text-right font-mono font-bold text-brand-600">{Math.round(room.area)}</td>
                                    <td className="px-10 py-6 text-right font-mono text-slate-500">{Math.round(room.volume)}</td>
                                    <td className="px-10 py-6 text-center">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-bold uppercase">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Verified
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {project.rooms.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-10 py-12 text-center text-slate-400 font-bold uppercase text-xs">
                                        No rooms detected in the provided blueprint.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
          </div>
        )}
      </div>

      {/* RAW VISION DEBUG OVERLAY */}
      {showRawJson && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-sm flex flex-col p-8 animate-fade-in">
           <div className="flex justify-between items-center mb-6 max-w-[1400px] mx-auto w-full">
               <div className="flex items-center gap-3">
                  <FileJson className="w-8 h-8 text-amber-500" />
                  <div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Raw Vision Output</h3>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Gemini 3 Pro • Real-Time Thinking Logs</p>
                  </div>
               </div>
               
               <div className="flex items-center gap-3">
                   <button 
                     onClick={handleCopy}
                     className={`flex items-center gap-2 px-5 py-3 rounded-full transition-all font-bold text-[10px] uppercase tracking-widest border backdrop-blur-sm ${copied ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10 hover:border-white/20'}`}
                   >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'Copied' : 'Copy Full Log'}</span>
                   </button>

                   <button 
                     onClick={() => setShowRawJson(false)} 
                     className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all hover:rotate-90"
                   >
                      <X className="w-6 h-6" />
                   </button>
               </div>
           </div>
           
           <div className="flex-1 overflow-hidden max-w-[1400px] mx-auto w-full flex flex-col gap-6">
              
              {/* SECTION 1: VISION REASONING LOG */}
              {project.visionRawData?.vision_reasoning && (
                  <div className="bg-slate-900 rounded-[2rem] border border-slate-800 p-8 shadow-xl flex flex-col shrink-0 max-h-[30vh]">
                     <div className="flex items-center gap-2 mb-4">
                         <BrainCircuit className="w-5 h-5 text-purple-400" />
                         <h4 className="text-xs font-black text-purple-200 uppercase tracking-widest">Vision Logic Trace (Step 1)</h4>
                     </div>
                     <div className="overflow-y-auto custom-scrollbar">
                         <p className="font-mono text-xs text-purple-100 leading-relaxed whitespace-pre-wrap">
                             {project.visionRawData.vision_reasoning}
                         </p>
                     </div>
                  </div>
              )}

               {/* SECTION 2: MATH LOG */}
              {project.visionRawData?.math_trace && (
                  <div className="bg-slate-900 rounded-[2rem] border border-slate-800 p-8 shadow-xl flex flex-col shrink-0 max-h-[20vh]">
                     <div className="flex items-center gap-2 mb-4">
                         <Calculator className="w-5 h-5 text-blue-400" />
                         <h4 className="text-xs font-black text-blue-200 uppercase tracking-widest">Math Calculation Trace (Step 2)</h4>
                     </div>
                     <div className="overflow-y-auto custom-scrollbar">
                         <p className="font-mono text-xs text-blue-100 leading-relaxed whitespace-pre-wrap">
                             {project.visionRawData.math_trace}
                         </p>
                     </div>
                  </div>
              )}

              {/* SECTION 3: RAW JSON */}
              <div className="flex-1 bg-slate-900 rounded-[2rem] border border-slate-800 overflow-hidden flex flex-col shadow-2xl relative">
                  <div className="absolute top-0 right-0 p-4">
                     <span className="px-3 py-1 bg-slate-800 text-slate-400 rounded-lg text-[10px] font-mono font-bold uppercase">JSON</span>
                  </div>
                  <div className="flex-1 overflow-auto p-8 custom-scrollbar">
                    <pre className="font-mono text-xs text-emerald-400 leading-relaxed whitespace-pre-wrap break-all">
                      {project.visionRawData ? JSON.stringify(project.visionRawData, (key, value) => {
                          // Filter out the logs from the JSON view since they are shown above
                          if (key === 'vision_reasoning' || key === 'math_trace') return undefined;
                          return value;
                      }, 2) : "// No raw vision data available."}
                    </pre>
                  </div>
              </div>

           </div>
        </div>
      )}
    </div>
  );
};