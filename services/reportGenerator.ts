
import { PDFDocument, StandardFonts, PageSizes } from 'pdf-lib';
import { ProjectState } from '../types';

export async function generateReportPdf(project: ProjectState): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage(PageSizes.Letter);
  const { width, height } = page.getSize();
  const margin = 50;

  let y = height - margin;

  const drawText = (text: string, x: number, currentY: number, size: number, isBold = false) => {
    page.drawText(text || '', { x, y: currentY, font: isBold ? boldFont : font, size });
  };

  // Page 1: Load Short Form
  drawText('Load Short Form', margin, y, 24, true);
  y -= 30;
  drawText(`Job: ${project.metadata.jobName}`, width - margin - 250, y + 20, 10);
  drawText(`By: ${project.metadata.designerName}`, width - margin - 250, y + 5, 10);
  y -= 20;

  drawText('Project Information', margin, y, 14, true);
  y -= 20;
  drawText(`For: ${project.metadata.clientName}, ${project.metadata.clientCompany}`, margin, y, 10);
  y -= 30;

  drawText('Design Information', margin, y, 14, true);
  y -= 20;
  const designHeaders = ['', 'Htg', 'Clg', 'Infiltration'];
  const designRows = [
    ['Outside db (°F)', project.designConditions.heating.outdoorDB, project.designConditions.cooling.outdoorDB, `Method: ${project.designConditions.infiltration.method}`],
    ['Inside db (°F)', project.designConditions.heating.indoorDB, project.designConditions.cooling.indoorDB, `Quality: ${project.designConditions.infiltration.quality}`],
    ['Design TD (°F)', project.designConditions.heating.designTD, project.designConditions.cooling.designTD, ''],
    ['Moisture diff (gr/lb)', '', project.designConditions.moistureDiff, '']
  ];
  let tableY = y;
  designHeaders.forEach((header, i) => drawText(header, margin + i * 120, tableY, 10, true));
  tableY -= 20;
  designRows.forEach(row => {
    row.forEach((cell, i) => drawText(String(cell), margin + i * 120, tableY, 10));
    tableY -= 15;
  });
  y = tableY - 20;

  drawText('HEATING EQUIPMENT', margin, y, 12, true);
  drawText('COOLING EQUIPMENT', margin + 300, y, 12, true);
  y -= 20;
  const heatEq = project.selectedEquipment.heating;
  const coolEq = project.selectedEquipment.cooling;
  drawText(`Make: ${heatEq.make}`, margin, y, 10);
  drawText(`Make: ${coolEq.make}`, margin + 300, y, 10);
  y -= 15;
  drawText(`Model: ${heatEq.model}`, margin, y, 10);
  drawText(`Cond: ${coolEq.model}`, margin + 300, y, 10);
  y -= 15;
  drawText(`AHRI ref: ${heatEq.ahriRef}`, margin, y, 10);
  drawText(`AHRI ref: ${coolEq.ahriRef}`, margin + 300, y, 10);
  y -= 15;
  drawText(`Efficiency: ${heatEq.efficiencyRating}`, margin, y, 10);
  drawText(`Efficiency: ${coolEq.efficiencyRating}`, margin + 300, y, 10);
  y -= 15;
  drawText(`Heating output: ${heatEq.outputBTU.toLocaleString()} Btuh`, margin, y, 10);
  drawText(`Total cooling: ${coolEq.outputBTU.toLocaleString()} Btuh`, margin + 300, y, 10);
  y -= 15;
  drawText(`Actual air flow: ${heatEq.airflowCFM} cfm`, margin, y, 10);
  drawText(`Actual air flow: ${coolEq.airflowCFM} cfm`, margin + 300, y, 10);
  y -= 30;

  drawText('ROOM BREAKDOWN', margin, y, 14, true);
  y -= 20;
  const roomHeaders = ['ROOM NAME', 'Area (ft²)', 'Htg load', 'Clg load', 'Htg CFM', 'Clg CFM'];
  tableY = y;
  roomHeaders.forEach((header, i) => drawText(header, margin + i * 85, tableY, 10, true));
  tableY -= 20;
  project.rooms.forEach(room => {
    const row = [
      room.name,
      Math.round(room.area),
      Math.round(room.calculationResult.heatingLoad),
      Math.round(room.calculationResult.coolingLoad),
      Math.round(room.calculationResult.heatingCFM),
      Math.round(room.calculationResult.coolingCFM)
    ];
    row.forEach((cell, i) => drawText(String(cell), margin + i * 85, tableY, 10));
    tableY -= 15;
    if (tableY < margin + 50) {
       // Simple pagination handling if needed, but for now strict single page fitting as per reference logic implication or overflow
       // To be robust we could addPage here, but sticking to reference structure.
    }
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
