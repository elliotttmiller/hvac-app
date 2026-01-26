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
  drawText(`Job: ${project.metadata?.jobName || 'N/A'}`, width - margin - 250, y + 20, 10);
  drawText(`By: ${project.metadata?.designerName || 'N/A'}`, width - margin - 250, y + 5, 10);
  y -= 20;

  drawText('Project Information', margin, y, 14, true);
  y -= 20;
  drawText(`For: ${project.metadata?.clientName || 'Valued Client'}, ${project.metadata?.clientCompany || ''}`, margin, y, 10);
  y -= 30;

  drawText('Design Information', margin, y, 14, true);
  y -= 20;
  const designHeaders = ['', 'Htg', 'Clg', 'Infiltration'];
  const designRows = [
    ['Outside db (°F)', project.designConditions?.heating?.outdoorDB || '-', project.designConditions?.cooling?.outdoorDB || '-', `Method: ${project.designConditions?.infiltration?.method || 'N/A'}`],
    ['Inside db (°F)', project.designConditions?.heating?.indoorDB || '-', project.designConditions?.cooling?.indoorDB || '-', `Quality: ${project.designConditions?.infiltration?.quality || 'N/A'}`],
    ['Design TD (°F)', project.designConditions?.heating?.designTD || '-', project.designConditions?.cooling?.designTD || '-', ''],
    ['Moisture diff (gr/lb)', '', project.designConditions?.moistureDiff || '-', '']
  ];
  let tableY = y;
  designHeaders.forEach((header, i) => drawText(header, margin + i * 120, tableY, 10, true));
  tableY -= 20;
  designRows.forEach(row => {
    row.forEach((cell, i) => drawText(String(cell), margin + i * 120, tableY, 10));
    tableY -= 15;
  });
  y = tableY - 20;

  // Defensive access to equipment
  const heatEq = project.selectedEquipment?.heating;
  const coolEq = project.selectedEquipment?.cooling;

  drawText('HEATING EQUIPMENT', margin, y, 12, true);
  drawText('COOLING EQUIPMENT', margin + 300, y, 12, true);
  y -= 20;
  
  if (heatEq) {
    drawText(`Make: ${heatEq.make}`, margin, y, 10);
    drawText(`Model: ${heatEq.model}`, margin, y - 15, 10);
    drawText(`AHRI ref: ${heatEq.ahriRef}`, margin, y - 30, 10);
    drawText(`Efficiency: ${heatEq.efficiencyRating}`, margin, y - 45, 10);
    drawText(`Heating output: ${(heatEq.outputBTU || 0).toLocaleString()} Btuh`, margin, y - 60, 10);
    drawText(`Actual air flow: ${heatEq.airflowCFM} cfm`, margin, y - 75, 10);
  } else {
    drawText('Equipment not yet selected.', margin, y, 10);
  }

  if (coolEq) {
    drawText(`Make: ${coolEq.make}`, margin + 300, y, 10);
    drawText(`Cond: ${coolEq.model}`, margin + 300, y - 15, 10);
    drawText(`AHRI ref: ${coolEq.ahriRef}`, margin + 300, y - 30, 10);
    drawText(`Efficiency: ${coolEq.efficiencyRating}`, margin + 300, y - 45, 10);
    drawText(`Total cooling: ${(coolEq.outputBTU || 0).toLocaleString()} Btuh`, margin + 300, y - 60, 10);
    drawText(`Actual air flow: ${coolEq.airflowCFM} cfm`, margin + 300, y - 75, 10);
  } else {
    drawText('Equipment not yet selected.', margin + 300, y, 10);
  }

  y -= 90;

  drawText('ROOM BREAKDOWN', margin, y, 14, true);
  y -= 20;
  const roomHeaders = ['ROOM NAME', 'Area (ft²)', 'Htg load', 'Clg load', 'Htg CFM', 'Clg CFM'];
  tableY = y;
  roomHeaders.forEach((header, i) => drawText(header, margin + i * 85, tableY, 10, true));
  tableY -= 20;
  
  (project.rooms || []).forEach(room => {
    const row = [
      room.name,
      Math.round(room.area || 0),
      Math.round(room.calculationResult?.heatingLoad || 0),
      Math.round(room.calculationResult?.coolingLoad || 0),
      Math.round(room.calculationResult?.heatingCFM || 0),
      Math.round(room.calculationResult?.coolingCFM || 0)
    ];
    row.forEach((cell, i) => drawText(String(cell), margin + i * 85, tableY, 10));
    tableY -= 15;
    if (tableY < margin + 50) {
       // Future expansion: addPage if table overflows
    }
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}