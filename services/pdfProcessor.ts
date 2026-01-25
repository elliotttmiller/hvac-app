// backend/utils/pdfProcessor.ts

import { Part } from '@google/genai';
import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker for the browser environment
// Note: In a real bundler setup, this might need to point to a local file or CDN differently.
// For this environment, using the ESM CDN URL is appropriate.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs`;

/**
 * Rasterizes a PDF's pages into high-fidelity JPEG images on the client (browser).
 * @param fileBuffer The ArrayBuffer of the uploaded PDF file.
 * @returns An array of `Part` objects ready for the Gemini Vision API.
 */
export async function rasterizePdfToParts(fileBuffer: ArrayBuffer): Promise<Part[]> {
  const imageParts: Part[] = [];
  
  try {
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(fileBuffer) });
    const pdfProxy = await loadingTask.promise;

    // Process a limited number of pages to manage cost/performance, or process all.
    const pagesToProcess = Math.min(pdfProxy.numPages, 10); // CONFIGURABLE
    console.log(`[PdfProcessor] Rasterizing ${pagesToProcess} of ${pdfProxy.numPages} pages...`);

    for (let i = 1; i <= pagesToProcess; i++) {
      const page = await pdfProxy.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 }); // High-resolution for accuracy

      // Use browser native canvas
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');

      if (!context) {
        console.error("Failed to get 2D context for PDF page");
        continue;
      }

      // Updated: pass 'canvas' property and cast to any to ensure compatibility with pdfjs-dist types
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas
      } as any).promise;

      // Convert the canvas to a JPEG base64 string
      // toDataURL returns "data:image/jpeg;base64,..."
      const base64Url = canvas.toDataURL('image/jpeg', 0.85);
      const base64Data = base64Url.split(',')[1];
      
      imageParts.push({ inlineData: { data: base64Data, mimeType: 'image/jpeg' } });
    }

    console.log(`[PdfProcessor] Rasterization complete. Generated ${imageParts.length} image parts.`);
  } catch (error) {
    console.error("Error rasterizing PDF:", error);
    throw error;
  }

  return imageParts;
}