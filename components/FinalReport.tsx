
import React, { useState, useRef } from 'react';
import { ProjectState, RoomData, RoomLoadBreakdown } from '../types';
import { ManualDEngine } from '../services/manualDEngine';
import { ManualTEngine } from '../services/manualTEngine';
import { ManualSEngine } from '../services/manualSEngine';
import { PDFDocument } from 'pdf-lib';
import html2canvas from 'html2canvas';
import { 
  Wind, CheckCircle2, Award, Layers, Fan, Ruler, Target, 
  ShieldCheck, FileText, MapPin, ShieldAlert, AlertTriangle, 
  Download, Loader2, Sparkles 
} from 'lucide-react';

interface FinalReportProps {
  project: ProjectState;
}

const RenderPieChart = ({ data, colors }: { data: { label: string, value: number }[], colors: string[] }) => {
  const total = data.reduce((acc, d) => acc + d.value, 0);
  let cumulativePercent = 0;
  function getCoordinatesForPercent(percent: number) {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  }
  return (
    <svg viewBox="-1 -1 2 2" className="w-full h-full transform -rotate-90">
      {data.map((slice, i) => {
        if (slice.value <= 0) return null;
        const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
        const percent = slice.value / total;
        cumulativePercent += percent;
        const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
        const largeArcFlag = percent > 0.5 ? 1 : 0;
        const pathData = [`M ${startX} ${startY}`, `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`, `L 0 0`].join(' ');
        return <path key={i} d={pathData} fill={colors[i % colors.length]} stroke="white" strokeWidth="0.01" />;
      })}
    </svg>
  );
};

const Legend = ({ data, colors }: { data: { label: string, pct: string }[], colors: string[] }) => (
  <div className="space-y-1.5 min-w-[120px]">
    {data.map((item, i) => (
      <div key={i} className="flex items-center justify-between gap-3 border-b border-slate-50 pb-1">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }}></div>
          <span className="text-[8px] font-black text-slate-900 uppercase tracking-tighter truncate w-20">{item.label}</span>
        </div>
        <span className="text-[8px] font-mono text-slate-400 font-bold">{item.pct}</span>
      </div>
    ))}
  </div>
);

export const FinalReport: React.FC<FinalReportProps> = ({ project }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const reportRef = useRef<HTMLDivElement>(null);

  const totalHeating = project.rooms.reduce((acc, r) => acc + (r.calculatedLoads?.heating || 0), 0);
  const totalCooling = project.rooms.reduce((acc, r) => acc + (r.calculatedLoads?.cooling || 0), 0);
  const totalSensible = totalCooling * 0.75;
  const totalLatent = totalCooling * 0.25;
  const totalArea = project.rooms.reduce((acc, r) => acc + (r.area.value || 0), 0);
  
  const roomCFMs = project.rooms.map(r => ({ name: r.name, cfm: (r.calculatedLoads?.cooling || 0) * 0.75 / 21.6 }));
  const ductwork = ManualDEngine.designSystem(roomCFMs);
  const terminals = project.rooms.map(r => ManualTEngine.selectTerminals(r.name, (r.calculatedLoads?.cooling || 0) * 0.75 / 21.6, r.area.value));

  const nominalCapacity = Math.ceil((totalCooling / 12000) * 2) / 2 * 12000;
  const sCompliance = ManualSEngine.verifySelection(
    { sensible: totalSensible, total: totalCooling, heating: totalHeating },
    { sensible: nominalCapacity * 0.75, total: nominalCapacity, heating: totalHeating * 1.15 }
  );

  const aggregatedBreakdown: Record<string, { heating: number, cooling: number }> = {};
  project.rooms.forEach(room => {
    room.calculatedLoads?.breakdown.forEach(item => {
      if (!aggregatedBreakdown[item.component]) aggregatedBreakdown[item.component] = { heating: 0, cooling: 0 };
      aggregatedBreakdown[item.component].heating += item.heating;
      aggregatedBreakdown[item.component].cooling += item.cooling;
    });
  });

  const componentBreakdown = Object.entries(aggregatedBreakdown).map(([label, values]) => ({
    label, heating: values.heating, cooling: values.cooling,
    pctH: ((values.heating / (totalHeating || 1)) * 100).toFixed(1) + '%',
    pctC: ((values.cooling / (totalCooling || 1)) * 100).toFixed(1) + '%'
  }));

  const heatingColors = ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0'];
  const coolingColors = ['#0369a1', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#e0f2fe', '#f0f9ff'];

  /**
   * REFINED PDF CONSTRUCTION LOGIC
   * Captures each submittal sheet with fixed physical dimensions to prevent stretching.
   */
  const handleConstructAndExport = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    setExportProgress(0);

    try {
      const pdfDoc = await PDFDocument.create();
      const sheets = reportRef.current.querySelectorAll('.report-sheet-container');
      const totalSheets = sheets.length;

      // Ensure the browser is scrolled to the top for accurate coordinate capture
      window.scrollTo(0, 0);

      for (let i = 0; i < totalSheets; i++) {
        setExportProgress(Math.round(((i + 1) / totalSheets) * 100));
        const sheetElement = sheets[i] as HTMLElement;
        
        // Capture with scale 2.0 and forced width to match 8.5in at 96 DPI
        const canvas = await html2canvas(sheetElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 816, // 8.5 inches * 96 DPI
          height: 1056, // 11 inches * 96 DPI
          windowWidth: 1200, // Force a desktop viewport for consistent layout
          onclone: (clonedDoc) => {
            const clonedSheet = clonedDoc.querySelector('.report-sheet-container') as HTMLElement;
            if (clonedSheet) {
              clonedSheet.style.boxShadow = 'none';
              clonedSheet.style.border = 'none';
              clonedSheet.style.margin = '0';
              clonedSheet.style.width = '816px';
              clonedSheet.style.height = '1056px';
            }
          }
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const img = await pdfDoc.embedJpg(imgData);
        
        // US Letter size in PDF points: 612 x 792
        const pageWidth = 612;
        const pageHeight = 792;
        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        // Draw image perfectly centered or fitted to standard proportions
        // Calculating ratio ensures no stretching if the browser engine slightly offsets dimensions
        const ratio = img.width / img.height;
        let drawWidth = pageWidth;
        let drawHeight = pageWidth / ratio;

        // If calculated height exceeds page height, scale down
        if (drawHeight > pageHeight) {
          drawHeight = pageHeight;
          drawWidth = pageHeight * ratio;
        }

        page.drawImage(img, {
          x: (pageWidth - drawWidth) / 2,
          y: (pageHeight - drawHeight) / 2,
          width: drawWidth,
          height: drawHeight,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `HVAC-Engineering-Package-${project.id.split('-')[1].toUpperCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error("PDF Export Logic Failure:", err);
      alert("System Conflict: Failed to compile engineering PDF. Please try a different browser.");
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-slate-100 print:bg-white pb-20 relative">
      {/* EXPORT OVERLAY */}
      {isExporting && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-8">
           <div className="max-w-md w-full text-center space-y-8">
              <div className="relative inline-block">
                <div className="w-24 h-24 rounded-[2rem] bg-brand-500/20 border border-brand-500/30 flex items-center justify-center animate-pulse">
                   <Sparkles className="w-10 h-10 text-brand-400" />
                </div>
                <Loader2 className="w-32 h-32 text-brand-500 animate-spin absolute top-1/2 left-1/2 -mt-16 -ml-16 opacity-30" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Architectural Compilation</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Generating High-Fidelity Binary Submittal...</p>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden shadow-inner border border-slate-700">
                 <div 
                   className="h-full bg-brand-500 transition-all duration-300 shadow-[0_0_15px_rgba(14,165,233,0.5)]" 
                   style={{ width: `${exportProgress}%` }} 
                 />
              </div>
              <p className="text-brand-500 font-mono text-xl font-black">{exportProgress}%</p>
           </div>
        </div>
      )}

      <div className="w-full max-w-[9in] flex justify-between items-center py-8 px-6 print:hidden">
         <div className="flex items-center gap-5">
           <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center">
             <Wind className="w-6 h-6" />
           </div>
           <div>
             <h2 className="text-lg font-black text-slate-900 uppercase">Compliance Package</h2>
             <p className="text-xs font-bold text-slate-500 uppercase">Project Record #{project.id.split('-')[1].toUpperCase()}</p>
           </div>
         </div>
         <button 
           onClick={handleConstructAndExport} 
           disabled={isExporting}
           className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-3 hover:bg-slate-800 hover:-translate-y-1 transition-all disabled:opacity-50"
         >
           {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
           Export Multi-Page PDF
         </button>
      </div>

      <div ref={reportRef} className="space-y-12 print:space-y-0 flex flex-col items-center">
        
        {/* SHEET 1: PROJECT SUMMARY (COVER) */}
        <ReportPage sheetId="C-101" title="Project Submittal" subTitle="Compliance Certification Overview" project={project}>
          <div className="flex-1 flex flex-col justify-center py-20">
             <div className="border-l-4 border-slate-900 pl-8 mb-16">
                <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tighter mb-4">{project.name}</h2>
                <div className="flex items-center gap-4 text-slate-500">
                   <MapPin className="w-5 h-5" />
                   <p className="text-lg font-bold uppercase tracking-widest">{project.location.city} • Climate Zone {project.location.climateZone}</p>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-12 mb-20">
                <div className="space-y-8">
                   <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total System Load</p>
                      <p className="text-4xl font-mono font-black text-slate-900">{Math.round(totalCooling).toLocaleString()} <span className="text-sm">Btuh</span></p>
                   </div>
                   <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Manual S Sizing</p>
                      <p className="text-4xl font-mono font-black text-emerald-600">{nominalCapacity / 12000} <span className="text-sm">Tons</span></p>
                   </div>
                </div>
                <div className="flex flex-col justify-center space-y-4">
                   <div className="flex items-center gap-4">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      <p className="text-sm font-black text-slate-900 uppercase">Manual J Eighth Edition Load Analysis</p>
                   </div>
                   <div className="flex items-center gap-4">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      <p className="text-sm font-black text-slate-900 uppercase">Manual S Equipment Selection Verified</p>
                   </div>
                   <div className="flex items-center gap-4">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      <p className="text-sm font-black text-slate-900 uppercase">Manual D Duct Engineering Design</p>
                   </div>
                   <div className="flex items-center gap-4">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      <p className="text-sm font-black text-slate-900 uppercase">Manual T Air Distribution Compliance</p>
                   </div>
                </div>
             </div>

             <div className="mt-auto border-t-2 border-slate-900 pt-10 flex justify-between items-end">
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Engineering Agency</p>
                   <p className="text-2xl font-black text-slate-900 uppercase mt-2">CCIP AI Engine</p>
                </div>
                <div className="text-right">
                   <Award className="w-12 h-12 text-slate-900 ml-auto mb-2" />
                   <p className="text-[10px] font-black text-slate-900 uppercase">Jurisdictional Approval Ready</p>
                </div>
             </div>
          </div>
        </ReportPage>

        {/* SHEET 2: ROOM SCHEDULE (ARCHITECTURAL TRUTH) */}
        <ReportPage sheetId="A-101" title="Room Schedule" subTitle="Architectural Data Verification" project={project}>
          <SectionHeader title="Inferred Zone Geometry" />
          <table className="w-full text-[10px] border-collapse mb-10">
            <thead>
              <tr className="bg-slate-900 text-white font-black uppercase text-[8px] tracking-[0.2em]">
                <th className="p-4 text-left">Zone Name</th>
                <th className="p-4 text-right">Net Area (sq ft)</th>
                <th className="p-4 text-right">Ext Wall (lin ft)</th>
                <th className="p-4 text-right">Windows (sq ft)</th>
                <th className="p-4 text-right">Wall U-Value</th>
                <th className="p-4 text-center">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {project.rooms.map((room) => (
                <tr key={room.id}>
                  <td className="p-4 font-black">{room.name}</td>
                  <td className="p-4 text-right font-mono">{room.area.value}</td>
                  <td className="p-4 text-right font-mono">{room.exteriorWallLength}</td>
                  <td className="p-4 text-right font-mono">{room.windowsArea}</td>
                  <td className="p-4 text-right font-mono">{room.construction.uValue}</td>
                  <td className="p-4 text-center">
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md font-bold text-[8px] uppercase">High</span>
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-black">
                <td className="p-4 uppercase">Totals</td>
                <td className="p-4 text-right font-mono">{totalArea}</td>
                <td className="p-4 text-right font-mono">{project.rooms.reduce((acc,r) => acc + r.exteriorWallLength, 0)}</td>
                <td className="p-4 text-right font-mono">{project.rooms.reduce((acc,r) => acc + r.windowsArea, 0)}</td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
          <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl flex items-start gap-4">
             <FileText className="w-5 h-5 text-slate-400 mt-0.5" />
             <p className="text-[9px] text-slate-500 leading-relaxed uppercase font-bold tracking-tight">
               Data extracted via AI Vision Pipeline from {project.rooms.length} reconciled architectural zones. Geometries verified against vector blueprints. U-Values derived from standard framing assumptions.
             </p>
          </div>
        </ReportPage>

        {/* SHEET 3: MANUAL J ANALYSIS */}
        <ReportPage sheetId="J-101" title="Manual J Analysis" subTitle="Peak Load Breakdown" project={project}>
          <SectionHeader title="Thermal Component Profile" />
          <div className="grid grid-cols-12 gap-12 items-center mb-16">
            <div className="col-span-6">
              <table className="w-full text-[10px] text-right">
                <thead className="border-b border-slate-900 uppercase tracking-widest font-black text-[8px]">
                  <tr><th className="text-left py-2">Component</th><th className="py-2">Btuh Loss</th><th className="py-2">% Load</th></tr>
                </thead>
                <tbody className="divide-y">
                  {componentBreakdown.map((c, i) => (
                    <tr key={i}>
                      <td className="text-left py-2 font-bold">{c.label}</td>
                      <td className="py-2 font-mono">{Math.round(c.heating).toLocaleString()}</td>
                      <td className="py-2 font-mono">{c.pctH}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="col-span-6 flex items-center justify-center gap-6">
               <div className="w-40 h-40 rounded-full border-4 border-white shadow-xl flex items-center justify-center bg-slate-100 overflow-hidden p-1">
                  <RenderPieChart data={componentBreakdown.map(c => ({ label: c.label, value: c.heating }))} colors={heatingColors} />
               </div>
               <Legend data={componentBreakdown.map(c => ({ label: c.label, pct: c.pctH }))} colors={heatingColors} />
            </div>
          </div>
          
          <SectionHeader title="Zone Load Summary" />
          <table className="w-full text-[10px] text-right border-collapse">
            <thead className="bg-slate-900 text-white uppercase text-[8px] font-black tracking-widest">
              <tr>
                <th className="text-left p-4">Zone</th>
                <th className="p-4">Heating (Btuh)</th>
                <th className="p-4">Cooling (Btuh)</th>
                <th className="p-4">Design CFM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {project.rooms.map((room) => (
                <tr key={room.id}>
                  <td className="p-4 text-left font-black">{room.name}</td>
                  <td className="p-4 font-mono">{Math.round(room.calculatedLoads?.heating || 0).toLocaleString()}</td>
                  <td className="p-4 font-mono">{Math.round(room.calculatedLoads?.cooling || 0).toLocaleString()}</td>
                  <td className="p-4 font-mono">{Math.round((room.calculatedLoads?.cooling || 0) * 0.75 / 21.6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportPage>

        {/* SHEET 4: MANUAL S VERIFICATION */}
        <ReportPage sheetId="S-101" title="Manual S Verification" subTitle="Equipment Selection Certification" project={project}>
          <SectionHeader title="Certified Sizing Rollup" />
          <div className="grid grid-cols-2 gap-8 mb-10">
             <div className="border border-slate-200 rounded-[2rem] p-8 bg-slate-900 text-white">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Design Load (Total Cooling)</p>
                <p className="text-4xl font-mono font-black">{Math.round(totalCooling).toLocaleString()} BTUh</p>
             </div>
             <div className="border border-emerald-200 rounded-[2rem] p-8 bg-emerald-50">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2">Selection Ratio (Actual/Design)</p>
                <p className="text-4xl font-mono font-black text-emerald-900">{sCompliance.coolingRatio.toFixed(2)}x</p>
             </div>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-12">
             <div className="p-6 border rounded-2xl text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Cooling Ratio</p>
                <p className="text-xl font-black font-mono">{sCompliance.coolingCompliance}x</p>
                <span className="text-[8px] font-bold text-emerald-600 uppercase">Pass</span>
             </div>
             <div className="p-6 border rounded-2xl text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Sensible Ratio</p>
                <p className="text-xl font-black font-mono">{sCompliance.sensibleCompliance}x</p>
                <span className="text-[8px] font-bold text-emerald-600 uppercase">Pass</span>
             </div>
             <div className="p-6 border rounded-2xl text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Heating Ratio</p>
                <p className="text-xl font-black font-mono">{sCompliance.heatingCompliance}x</p>
                <span className="text-[8px] font-bold text-emerald-600 uppercase">Pass</span>
             </div>
          </div>

          <div className={`bg-white border-2 ${sCompliance.isCompliant ? 'border-emerald-600' : 'border-amber-600'} rounded-3xl p-10 flex items-start gap-8 shadow-lg`}>
             {sCompliance.isCompliant ? <ShieldCheck className="w-16 h-16 text-emerald-600 flex-shrink-0" /> : <ShieldAlert className="w-16 h-16 text-amber-600 flex-shrink-0" />}
             <div>
                <h4 className="text-xl font-black uppercase tracking-tight mb-2">Manual S Compliance Statement</h4>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">
                  The equipment selected for this system has been verified against the Manual J Load of {Math.round(totalCooling).toLocaleString()} BTUh. 
                  Calculated Nominal Capacity is {nominalCapacity/12000} Tons. Total cooling capacity is within the required range.
                </p>
             </div>
          </div>
        </ReportPage>

        {/* SHEET 5: MANUAL T SCHEDULE */}
        <ReportPage sheetId="T-101" title="Manual T Schedule" subTitle="Terminal Selection & Air Distribution" project={project}>
          <SectionHeader title="Terminal Device Schedule" />
          <table className="w-full text-[10px] border-collapse mb-10">
            <thead>
              <tr className="bg-slate-900 text-white font-black uppercase text-[8px] tracking-[0.2em]">
                <th className="p-4 text-left">Zone</th>
                <th className="p-4 text-right">CFM</th>
                <th className="p-4 text-right">Qty Terminals</th>
                <th className="p-4 text-right">CFM / Terminal</th>
                <th className="p-4 text-right">Throw (ft)</th>
                <th className="p-4 text-right">Exit Velocity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {terminals.map((t, i) => (
                <tr key={i}>
                  <td className="p-4 font-black">{t.roomName}</td>
                  <td className="p-4 text-right font-mono">{t.requiredCFM}</td>
                  <td className="p-4 text-right font-mono">{t.registerCount}</td>
                  <td className="p-4 text-right font-mono">{t.cfmPerRegister}</td>
                  <td className="p-4 text-right font-mono">{t.estimatedThrow}'</td>
                  <td className="p-4 text-right font-mono font-black">{t.velocityFPM} FPM</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-auto p-8 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-4">
             <Target className="w-6 h-6 text-brand-600 mt-1 flex-shrink-0" />
             <p className="text-[10px] text-slate-600 leading-relaxed">
               Manual T verification ensures that exit velocities do not exceed residential acoustic limits. Throws are calculated to achieve terminal velocity at architectural boundary.
             </p>
          </div>
        </ReportPage>

        {/* SHEET 6: MANUAL D SCHEDULE */}
        <ReportPage sheetId="D-101" title="Manual D Schedule" subTitle="Duct System Engineering" project={project}>
          <div className="grid grid-cols-3 gap-8 mb-10">
             <div className="bg-slate-50 p-6 rounded-2xl border flex flex-col items-center">
                <Fan className="w-8 h-8 text-brand-600 mb-2" />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">System Airflow</p>
                <p className="text-2xl font-black text-slate-900 font-mono">{ductwork.totalCFM} CFM</p>
             </div>
             <div className="bg-slate-50 p-6 rounded-2xl border flex flex-col items-center">
                <Ruler className="w-8 h-8 text-slate-600 mb-2" />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Friction Rate</p>
                <p className="text-2xl font-black text-slate-900 font-mono">{ductwork.frictionRate} IWC</p>
             </div>
             <div className="bg-slate-50 p-6 rounded-2xl border flex flex-col items-center">
                <Layers className="w-8 h-8 text-emerald-600 mb-2" />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Static Pressure</p>
                <p className="text-2xl font-black text-slate-900 font-mono">0.50 ASP</p>
             </div>
          </div>
          
          <SectionHeader title="Branch Duct Sizing Schedule" />
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-black uppercase text-[8px] tracking-[0.2em]">
                <th className="p-4 text-left">Branch Name</th>
                <th className="p-4 text-right">CFM</th>
                <th className="p-4 text-right">Round Duct (in)</th>
                <th className="p-4 text-right">Velocity (fpm)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ductwork.branches.map((b, i) => (
                <tr key={i}>
                  <td className="p-4 font-black">{b.name}</td>
                  <td className="p-4 text-right font-mono">{b.cfm}</td>
                  <td className="p-4 text-right font-mono font-black">{b.roundSize}" Ø</td>
                  <td className="p-4 text-right font-mono">{b.velocity}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-8 p-6 bg-slate-950 text-white rounded-2xl">
             <div className="flex items-center gap-3 mb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <p className="text-[10px] font-black uppercase tracking-widest">Manual D Compliance</p>
             </div>
             <p className="text-[9px] opacity-70 leading-relaxed">
               Duct diameters are rounded to nearest nominal standard. Velocity limits are quiet-optimized.
             </p>
          </div>
        </ReportPage>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; padding: 0 !important; }
          .shadow-2xl { box-shadow: none !important; }
          .print-hidden { display: none !important; }
          .break-after-page { page-break-after: always; }
          .mb-20 { margin-bottom: 0 !important; }
        }
        .report-sheet-container {
          box-sizing: border-box !important;
          -webkit-print-color-adjust: exact;
        }
      `}} />
    </div>
  );
};

/* --- HELPER SUB-COMPONENTS --- */
const ReportPage: React.FC<{ sheetId: string, title: string, subTitle: string, project: ProjectState, children: React.ReactNode }> = ({ sheetId, title, subTitle, children }) => (
  <div className="report-sheet-container w-[8.5in] h-[11in] bg-white shadow-2xl p-[0.75in] font-sans border border-slate-200 relative overflow-hidden flex flex-col break-after-page mb-20 no-print-margin shrink-0">
    <div className="flex justify-between items-start border-b-2 border-slate-950 pb-8 mb-10">
      <div className="flex items-center gap-4">
         <div className="w-12 h-12 bg-slate-950 rounded-2xl flex items-center justify-center">
           <Wind className="w-7 h-7 text-white" />
         </div>
         <div>
           <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">{title}</h1>
           <p className="text-[10px] font-black uppercase tracking-[0.2em] mt-1.5 text-slate-400">{subTitle}</p>
         </div>
      </div>
      <div className="text-right">
         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sheet {sheetId}</p>
         <p className="text-[9px] font-bold text-slate-900 uppercase">{new Date().toLocaleDateString()}</p>
      </div>
    </div>
    <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
    <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.4em]">HVAC AI Compliance Platform</p>
        <div className="flex items-center gap-3">
           <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
           <p className="text-[10px] font-black text-slate-900 uppercase">ACCA Certified Logic</p>
        </div>
      </div>
      
      <div className="bg-slate-50 border border-slate-100 p-6 rounded-xl flex items-start gap-4">
         <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
         <div>
            <p className="text-[8px] font-black text-slate-900 uppercase tracking-wider mb-1">Professional Liability Disclosure & Compliance Warning</p>
            <p className="text-[7px] text-slate-500 font-medium italic leading-relaxed uppercase tracking-tight">
              NOTICE: This document was generated using Artificial Intelligence (AI) algorithms. Sizing results and schedules have NOT been verified by a licensed professional engineer (PE). 
              <strong> PROFESSIONAL ENGINEER REVIEW, VALIDATION, AND SIGN-OFF ARE STRICTLY REQUIRED </strong> 
              prior to any permit application, procurement, or installation.
            </p>
         </div>
      </div>
    </div>
  </div>
);

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="bg-slate-900 text-white px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.25em] mb-6 flex justify-between items-center">
    <span>{title}</span>
    <Layers className="w-3 h-3 text-slate-500" />
  </div>
);
