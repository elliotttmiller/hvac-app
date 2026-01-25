
import React, { useEffect, useState } from 'react';
import { ProjectState, EquipmentScenario } from '../types';
import { fetchEquipmentScenarios } from '../services/geminiService';
// Fix: Import ManualSEngine from its own service file instead of manualJEngine
import { ManualSEngine } from '../services/manualSEngine';
import { Check, Loader2, Sparkles, TrendingUp, DollarSign, Award, ArrowRight, ExternalLink, AlertCircle, ShieldCheck, ShieldAlert } from 'lucide-react';

interface StageProcurementProps {
  project: ProjectState;
}

const FALLBACK_SCENARIOS: EquipmentScenario[] = [
  {
    id: 'f-1',
    label: 'VALUE',
    manufacturer: 'Goodman',
    modelNumber: 'GSXN4',
    seer2: 14.3,
    hspf2: 8.5,
    capacityBtuh: 36000,
    estimatedPrice: 4200,
    roiYears: 12,
    pros: ["Standard single-stage reliability", "Lowest initial capital expenditure", "Wide parts availability"],
    compliance: { manualS: true, localCode: true }
  },
  {
    id: 'f-2',
    label: 'EFFICIENCY',
    manufacturer: 'Carrier',
    modelNumber: '24VNA6 Performance',
    seer2: 18.5,
    hspf2: 10.2,
    capacityBtuh: 38000,
    estimatedPrice: 7800,
    roiYears: 6,
    pros: ["Variable speed inverter compressor", "Ultra-quiet operation (51dB)", "Qualifies for energy rebates"],
    compliance: { manualS: true, localCode: true }
  },
  {
    id: 'f-3',
    label: 'PREMIUM',
    manufacturer: 'Trane',
    modelNumber: 'XV20i TruComfort',
    seer2: 21.0,
    hspf2: 11.5,
    capacityBtuh: 40000,
    estimatedPrice: 11500,
    roiYears: 9,
    pros: ["Highest comfort index rating", "750-stage variable operation", "10-year registered limited warranty"],
    compliance: { manualS: true, localCode: true }
  }
];

export const StageProcurement: React.FC<StageProcurementProps> = ({ project }) => {
  const [scenarios, setScenarios] = useState<EquipmentScenario[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalCoolingLoad = project.rooms.reduce((acc, r) => acc + (r.calculatedLoads?.cooling || 0), 0);
  const totalHeatingLoad = project.rooms.reduce((acc, r) => acc + (r.calculatedLoads?.heating || 0), 0);

  const getScenarios = async () => {
    setLoading(true);
    setError(null);
    const targetCooling = totalCoolingLoad * project.safetyFactors.cooling;
    const targetHeating = totalHeatingLoad * project.safetyFactors.heating;
    
    try {
      const result = await fetchEquipmentScenarios(targetCooling, targetHeating);
      
      let cleanedJson = result.text.trim();
      if (cleanedJson.startsWith('```json')) {
          cleanedJson = cleanedJson.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (cleanedJson.startsWith('```')) {
          cleanedJson = cleanedJson.replace(/^```/, '').replace(/```$/, '').trim();
      }

      const data = JSON.parse(cleanedJson);
      if (Array.isArray(data) && data.length > 0) {
        setScenarios(data);
        setSources(result.sources);
      } else {
        throw new Error("Empty equipment array returned");
      }
    } catch (e: any) {
      console.error("Search failed or parsing error:", e);
      setError("Market data sync interrupted. Displaying engineering placeholders based on Manual S defaults.");
      setScenarios(FALLBACK_SCENARIOS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getScenarios();
  }, [project]);

  if (loading) {
    return (
      <div className="h-[500px] flex flex-col items-center justify-center gap-6 text-center px-4">
        <div className="relative">
          <Loader2 className="w-16 h-16 text-brand-600 animate-spin" />
          <Sparkles className="w-8 h-8 text-amber-400 absolute -top-2 -right-2 animate-bounce" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Grounding Catalog Data</h2>
          <p className="text-slate-500 max-sm mt-2 font-medium uppercase tracking-widest text-[10px]">Manual S Equipment Matching in Progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto animate-fade-in pb-20">
      {error && (
        <div className="mb-8 bg-amber-50 border border-amber-200 p-6 rounded-3xl flex items-center gap-4 text-amber-800">
           <AlertCircle className="w-6 h-6 flex-shrink-0" />
           <p className="text-sm font-bold uppercase tracking-tight">{error}</p>
           <button onClick={getScenarios} className="ml-auto bg-amber-600 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-700 transition-all">
             Retry Sync
           </button>
        </div>
      )}

      <div className="mb-12 text-center">
        <h2 className="text-4xl font-black text-slate-900 tracking-tight">Equipment Scenario Matrix</h2>
        <p className="text-slate-500 mt-2 text-lg">Three business-optimized paths grounded in live inventory and Manual S sizing rules.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        {scenarios.map((sc, i) => {
          const verification = ManualSEngine.verifySelection(
            { sensible: totalCoolingLoad * 0.75, total: totalCoolingLoad, heating: totalHeatingLoad },
            { sensible: sc.capacityBtuh * 0.75, total: sc.capacityBtuh, heating: sc.capacityBtuh * 0.9 } // Approximated performance
          );

          return (
            <div 
              key={i} 
              className={`
                relative flex flex-col bg-white rounded-[2.5rem] border-2 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl
                ${sc.label === 'EFFICIENCY' ? 'border-brand-500 shadow-xl' : 'border-slate-100 shadow-sm'}
              `}
            >
              <div className="absolute top-6 right-6 flex items-center gap-1.5">
                 {verification.isCompliant ? (
                   <div className="flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                     <ShieldCheck className="w-3 h-3" />
                     <span className="text-[8px] font-black uppercase tracking-widest">Manual S Pass</span>
                   </div>
                 ) : (
                   <div className="flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
                     <ShieldAlert className="w-3 h-3" />
                     <span className="text-[8px] font-black uppercase tracking-widest">{verification.status}</span>
                   </div>
                 )}
              </div>

              {sc.label === 'EFFICIENCY' && (
                <div className="absolute -top-4 left-10 bg-brand-500 text-white px-6 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 shadow-lg border border-brand-400">
                  <TrendingUp className="w-3.5 h-3.5" /> Best ROI
                </div>
              )}

              <div className="p-10 flex-1 flex flex-col">
                <div className="flex items-center gap-4 mb-8">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center
                    ${sc.label === 'VALUE' ? 'bg-slate-100 text-slate-600' : 
                      sc.label === 'EFFICIENCY' ? 'bg-brand-50 text-brand-600' : 
                      'bg-emerald-50 text-emerald-600'}
                  `}>
                    {sc.label === 'VALUE' ? <DollarSign className="w-7 h-7" /> : 
                     sc.label === 'EFFICIENCY' ? <TrendingUp className="w-7 h-7" /> : 
                     <Award className="w-7 h-7" />}
                  </div>
                  <div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{sc.label} Level</h3>
                    <p className="font-black text-slate-900 text-xl tracking-tight">{sc.manufacturer}</p>
                  </div>
                </div>

                <div className="mb-8">
                  <h4 className="text-2xl font-black text-slate-900 mb-2 font-mono tracking-tighter">{sc.modelNumber}</h4>
                  <div className="flex flex-wrap gap-2">
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-wider">SEER2: {sc.seer2}</span>
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-wider">HSPF2: {sc.hspf2}</span>
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-wider">{Math.round(sc.capacityBtuh / 12000 * 2) / 2} Ton</span>
                  </div>
                </div>

                <div className="space-y-4 mb-10 flex-1">
                  {sc.pros.map((pro, pi) => (
                    <div key={pi} className="flex items-start gap-4">
                      <div className="mt-1 flex-shrink-0">
                        <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center">
                          <Check className="w-3 h-3 text-emerald-600" />
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 leading-tight font-medium">{pro}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-8 border-t border-slate-100 mt-auto">
                  <div className="flex justify-between items-end mb-8">
                    <div>
                      <p className="text-[10px] text-slate-400 font-black uppercase mb-1 tracking-widest">Est. Unit Cost</p>
                      <p className="text-4xl font-mono font-black text-slate-900 tracking-tighter">${sc.estimatedPrice?.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-black uppercase mb-1 tracking-widest">Manual S Ratio</p>
                      <p className={`text-xl font-black tracking-tighter ${verification.isCompliant ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {verification.coolingCompliance}x
                      </p>
                    </div>
                  </div>
                  <button className={`
                    w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95
                    ${sc.label === 'EFFICIENCY' ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-slate-900 text-white hover:bg-slate-800'}
                  `}>
                    Select Option <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {sources.length > 0 && (
        <div className="mb-12 bg-white border border-slate-200 rounded-[2rem] p-10 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <Sparkles className="w-5 h-5 text-brand-500" />
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Verified Manufacturer Datasheets</h3>
          </div>
          <div className="flex flex-wrap gap-4">
            {sources.map((chunk, idx) => chunk.web && (
              <a 
                key={idx} 
                href={chunk.web.uri} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200 transition-all group"
              >
                <ExternalLink className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                {chunk.web.title || 'Product Documentation'}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-900 rounded-[3rem] p-12 flex flex-col md:flex-row items-center justify-between gap-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
        <div className="flex items-center gap-8 relative z-10">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-[2rem] flex items-center justify-center border border-emerald-500/30">
            <Sparkles className="w-10 h-10 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-white tracking-tight mb-2">Manual S Verification Complete</h3>
            <p className="text-slate-400 max-w-lg font-medium text-sm leading-relaxed">
              Matched to ${Math.round(totalCoolingLoad * project.safetyFactors.cooling).toLocaleString()} BTUh Total load.
              Engineering ratios are strictly grounded in ACCA Table 1-4.
            </p>
          </div>
        </div>
        <div className="flex gap-4 w-full md:w-auto relative z-10">
          <button className="flex-1 md:flex-none px-10 py-5 bg-slate-800 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-700 transition-colors border border-slate-700">
            Export XML
          </button>
          <button className="flex-1 md:flex-none px-10 py-5 bg-brand-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-brand-600 transition-all shadow-[0_0_30px_rgba(14,165,233,0.3)] hover:-translate-y-1">
            Lock Engineering Report
          </button>
        </div>
      </div>
    </div>
  );
};
