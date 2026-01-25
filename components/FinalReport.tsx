
import React, { useState } from 'react';
import { ProjectState } from '../types';
import { generateReportPdf } from '../services/reportGenerator';
import { 
  Wind, CheckCircle2, AlertTriangle, Download, Loader2 
} from 'lucide-react';

interface FinalReportProps {
  project: ProjectState;
}

const AEDGraph = ({ loads }: { loads: number[] }) => {
  const max = Math.max(...loads) * 1.2;
  return (
    <div className="w-full h-32 flex items-end gap-1 relative border-b border-l border-slate-300">
      {loads.map((load, i) => (
        <div key={i} className="flex-1 bg-brand-200 hover:bg-brand-500 transition-colors relative group" style={{ height: `${(load/max)*100}%` }}>
           <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-[7px] bg-slate-800 text-white px-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none">
             {Math.round(load)}
           </div>
        </div>
      ))}
      <div className="absolute top-0 right-0 p-1">
        <span className="text-[8px] font-bold text-slate-400">Hourly Glazing Load</span>
      </div>
    </div>
  )
}

export const FinalReport: React.FC<FinalReportProps> = ({ project }) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const pdfBytes = await generateReportPdf(project);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `HVAC-Submittal-${project.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Failed to generate PDF report.');
    } finally {
      setIsExporting(false);
    }
  };

  const { advancedSimulations, systemTotals, designConditions, metadata } = project;

  return (
    <div className="flex flex-col items-center min-h-screen bg-slate-100 print:bg-white pb-20 relative">
      {isExporting && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-8">
           <div className="max-w-md w-full text-center space-y-8">
              <Loader2 className="w-20 h-20 text-brand-500 animate-spin mx-auto" />
              <p className="text-white font-bold uppercase tracking-widest">Generating PDF Binary...</p>
           </div>
        </div>
      )}

      <div className="w-full max-w-[9in] flex justify-between items-center py-8 px-6 print:hidden">
         <h2 className="text-lg font-black text-slate-900 uppercase">Submittal Preview</h2>
         <button onClick={handleExport} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase shadow-xl flex items-center gap-3 hover:bg-slate-800 transition-colors">
           <Download className="w-4 h-4" /> Download PDF
         </button>
      </div>

      <div className="space-y-12 print:space-y-0 flex flex-col items-center">
        
        {/* REPORT PREVIEW (HTML Representation of PDF content) */}
        <ReportPage sheetId="J-101" title="Load Short Form" subTitle="Entire House • Heating and Cooling" project={project}>
          <div className="grid grid-cols-2 gap-8 mb-6 text-xs">
             <div>
                <p className="font-bold">For: <span className="font-normal">{metadata.clientName}</span></p>
                <p>{metadata.clientCompany}</p>
             </div>
             <div className="text-right">
                <p className="font-bold">By: <span className="font-normal">{metadata.designerName}</span></p>
                <p>Job: {metadata.jobName}</p>
             </div>
          </div>

          {/* Design Info */}
          <div className="grid grid-cols-3 gap-4 mb-6 text-[10px] border-b-2 border-slate-900 pb-4">
             <div>
                <table className="w-full">
                   <thead>
                     <tr className="border-b border-slate-300"><th className="text-left"></th><th className="text-right">Htg</th><th className="text-right">Clg</th></tr>
                   </thead>
                   <tbody>
                      <tr><td className="font-bold">Outside db (°F)</td><td className="text-right">{designConditions.heating.outdoorDB}</td><td className="text-right">{designConditions.cooling.outdoorDB}</td></tr>
                      <tr><td className="font-bold">Inside db (°F)</td><td className="text-right">{designConditions.heating.indoorDB}</td><td className="text-right">{designConditions.cooling.indoorDB}</td></tr>
                   </tbody>
                </table>
             </div>
             <div>
                <table className="w-full">
                   <tbody>
                      <tr><td className="font-bold">Daily Range</td><td className="text-right">{designConditions.cooling.dailyRange}</td></tr>
                      <tr><td className="font-bold">Moisture Diff</td><td className="text-right" colSpan={2}>{designConditions.moistureDiff}</td></tr>
                   </tbody>
                </table>
             </div>
          </div>

          {/* Room Schedule */}
          <table className="w-full text-[9px] mb-8">
             <thead className="bg-slate-100 border-t-2 border-b-2 border-slate-900">
               <tr>
                 <th className="p-2 text-left uppercase font-black">Room Name</th>
                 <th className="p-2 text-right uppercase font-black">Area (ft²)</th>
                 <th className="p-2 text-right uppercase font-black">Htg Load</th>
                 <th className="p-2 text-right uppercase font-black">Clg Load</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-200">
                {project.rooms.map((r, i) => (
                   <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="p-2 font-bold">{r.name}</td>
                      <td className="p-2 text-right">{Math.round(r.area)}</td>
                      <td className="p-2 text-right">{Math.round(r.calculationResult.heatingLoad)}</td>
                      <td className="p-2 text-right">{Math.round(r.calculationResult.coolingLoad)}</td>
                   </tr>
                ))}
                <tr className="bg-slate-900 text-white font-black border-t-2 border-black">
                   <td className="p-2 uppercase">Entire House</td>
                   <td className="p-2 text-right">{Math.round(project.rooms.reduce((a,r)=>a+r.area,0))}</td>
                   <td className="p-2 text-right">{Math.round(systemTotals.totalHeating)}</td>
                   <td className="p-2 text-right">{Math.round(systemTotals.totalCooling)}</td>
                </tr>
             </tbody>
          </table>
        </ReportPage>

        {/* PAGE 2: AED & DETAILS */}
        <ReportPage sheetId="J-102" title="Advanced Analysis" subTitle="AED & Multi-Orientation" project={project}>
           <div className="grid grid-cols-2 gap-12 mb-10">
              <div className="border border-slate-200 p-6 rounded-xl">
                 <h4 className="font-black uppercase text-xs mb-4">Hourly Glazing Load Profile</h4>
                 <AEDGraph loads={advancedSimulations.aed.hourlyLoads} />
              </div>
              <div className="space-y-6">
                 <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <p className="text-[10px] uppercase font-black text-slate-400">Peak Excursion</p>
                    <p className="text-3xl font-black text-slate-900">{advancedSimulations.aed.maxExcursionPercent}%</p>
                    <p className="text-[10px] text-slate-500 mt-1">Limit: 30%</p>
                 </div>
                 <div className={`p-6 rounded-xl border flex items-center gap-4 ${advancedSimulations.aed.status === 'Pass' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    {advancedSimulations.aed.status === 'Pass' ? <CheckCircle2 className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
                    <div>
                       <p className="font-black uppercase text-sm">AED Diversity: {advancedSimulations.aed.status}</p>
                    </div>
                 </div>
              </div>
           </div>
        </ReportPage>
      </div>
    </div>
  );
};

const ReportPage: React.FC<{ sheetId: string, title: string, subTitle: string, project: ProjectState, children: React.ReactNode }> = ({ sheetId, title, subTitle, project, children }) => (
  <div className="report-sheet-container w-[8.5in] h-[11in] bg-white shadow-2xl p-[0.5in] font-sans border border-slate-200 relative overflow-hidden flex flex-col break-after-page mb-20 no-print-margin shrink-0">
    <div className="flex justify-between items-start border-b-4 border-slate-900 pb-4 mb-6">
      <div className="flex items-center gap-3">
         <div className="w-10 h-10 bg-brand-600 flex items-center justify-center text-white">
           <Wind className="w-6 h-6" />
         </div>
         <div>
           <h1 className="text-xl font-black uppercase tracking-tight text-slate-900 leading-none">{title}</h1>
           <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">{subTitle}</p>
         </div>
      </div>
      <div className="text-right">
         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Job #{project.id}</p>
         <p className="text-[9px] font-bold text-slate-900 uppercase">{new Date().toLocaleDateString()}</p>
      </div>
    </div>
    <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
    <div className="mt-auto pt-4 border-t border-slate-200 flex justify-between items-center text-[8px] uppercase font-bold text-slate-400">
      <span>Powered by CCIP AI Engine</span>
      <span>Calculations approved by ACCA Manual J 8th Ed</span>
      <span>Page {sheetId}</span>
    </div>
  </div>
);
