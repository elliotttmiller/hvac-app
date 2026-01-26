/**
 * PDF Processing Module with Advanced Image Preprocessing
 * 
 * This module handles:
 * - PDF to image conversion using pdf.js
 * - Advanced image preprocessing for blueprint optimization
 * - Multiple quality presets for different blueprint types
 * - Adaptive scaling and compression
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker for the browser environment
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs`;

// ==================== TYPE DEFINITIONS ====================

/**
 * Part type matching AI SDK format
 */
export interface Part {
  inlineData: {
    data: string;      // Base64-encoded image data
    mimeType: string;  // MIME type (e.g., 'image/jpeg')
  };
}

/**
 * Comprehensive image preprocessing configuration
 */
export interface PreprocessingConfig {
  scale: number;                    // PDF rendering scale (1.0-5.0)
  enhanceContrast: boolean;        // Apply contrast enhancement
  contrastFactor: number;          // Contrast adjustment strength (1.0-2.0)
  sharpen: boolean;                // Apply sharpening filter
  sharpenStrength: 'light' | 'medium' | 'strong';
  denoise: boolean;                // Apply noise reduction
  binarize: boolean;               // Convert to black & white
  binarizeMethod: 'otsu' | 'adaptive' | 'threshold';
  binarizeThreshold: number;       // Manual threshold (0-255)
  quality: number;                 // JPEG quality (0.0-1.0)
  format: 'jpeg' | 'png';          // Output image format
  maxDimension: number;            // Max width/height in pixels
  preserveAspectRatio: boolean;    // Maintain aspect ratio when scaling
}

/**
 * Processing statistics for monitoring
 */
export interface ProcessingStats {
  totalPages: number;
  processedPages: number;
  totalSizeKB: number;
  averageSizeKB: number;
  processingTimeMs: number;
  errorCount: number;
  warnings: string[];
}

// ==================== DEFAULT CONFIGURATION ====================

const DEFAULT_CONFIG: PreprocessingConfig = {
  scale: 4.0,
  enhanceContrast: true,
  contrastFactor: 1.5,
  sharpen: true,
  sharpenStrength: 'medium',
  denoise: false,
  binarize: false,
  binarizeMethod: 'otsu',
  binarizeThreshold: 128,
  quality: 0.85,
  format: 'jpeg',
  maxDimension: 4096,
  preserveAspectRatio: true,
};

// ==================== IMAGE PROCESSING UTILITIES ====================

/**
 * Enhanced contrast adjustment with configurable strength
 */
function enhanceContrast(
  imageData: ImageData, 
  factor: number = 1.5
): ImageData {
  const data = imageData.data;
  const contrastFactor = (259 * (factor * 255 + 255)) / (255 * (259 - factor * 255));
  
  for (let i = 0; i < data.length; i += 4) {
    // Apply contrast to RGB channels
    data[i] = Math.min(255, Math.max(0, contrastFactor * (data[i] - 128) + 128));
    data[i + 1] = Math.min(255, Math.max(0, contrastFactor * (data[i + 1] - 128) + 128));
    data[i + 2] = Math.min(255, Math.max(0, contrastFactor * (data[i + 2] - 128) + 128));
    // Alpha channel unchanged
  }
  
  return imageData;
}

/**
 * Sharpening filter with adjustable strength
 */
function sharpenImage(
  imageData: ImageData, 
  strength: 'light' | 'medium' | 'strong' = 'medium'
): ImageData {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const output = new Uint8ClampedArray(data.length);
  
  // Copy original data
  output.set(data);
  
  // Sharpening kernels
  const kernels = {
    light: [0, -0.5, 0, -0.5, 3, -0.5, 0, -0.5, 0],
    medium: [0, -1, 0, -1, 5, -1, 0, -1, 0],
    strong: [-1, -1, -1, -1, 9, -1, -1, -1, -1],
  };
  
  const kernel = kernels[strength];
  
  // Apply convolution (skip borders)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) { // RGB only
        let sum = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixelIndex = ((y + ky) * width + (x + kx)) * 4 + c;
            const kernelIndex = (ky + 1) * 3 + (kx + 1);
            sum += data[pixelIndex] * kernel[kernelIndex];
          }
        }
        
        const outputIndex = (y * width + x) * 4 + c;
        output[outputIndex] = Math.min(255, Math.max(0, sum));
      }
    }
  }
  
  return new ImageData(output, width, height);
}

/**
 * Simple noise reduction filter
 */
function denoiseImage(imageData: ImageData): ImageData {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const output = new Uint8ClampedArray(data.length);
  
  // 3x3 averaging filter
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let count = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixelIndex = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += data[pixelIndex];
            count++;
          }
        }
        
        const outputIndex = (y * width + x) * 4 + c;
        output[outputIndex] = Math.round(sum / count);
      }
      
      // Copy alpha
      const alphaIndex = (y * width + x) * 4 + 3;
      output[alphaIndex] = data[alphaIndex];
    }
  }
  
  return new ImageData(output, width, height);
}

/**
 * Otsu's method for automatic threshold calculation
 */
function calculateOtsuThreshold(histogram: number[], total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }
  
  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVariance = 0;
  let threshold = 0;
  
  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    
    wF = total - wB;
    if (wF === 0) break;
    
    sumB += t * histogram[t];
    
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    
    const variance = wB * wF * (mB - mF) * (mB - mF);
    
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }
  
  return threshold;
}

/**
 * Adaptive thresholding for varying lighting conditions
 */
function adaptiveBinarize(imageData: ImageData, blockSize: number = 16): ImageData {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  
  // Calculate local thresholds
  const thresholds = new Array(Math.ceil(height / blockSize))
    .fill(0)
    .map(() => new Array(Math.ceil(width / blockSize)).fill(128));
  
  for (let by = 0; by < thresholds.length; by++) {
    for (let bx = 0; bx < thresholds[0].length; bx++) {
      let sum = 0;
      let count = 0;
      
      for (let y = by * blockSize; y < Math.min((by + 1) * blockSize, height); y++) {
        for (let x = bx * blockSize; x < Math.min((bx + 1) * blockSize, width); x++) {
          const index = (y * width + x) * 4;
          const gray = Math.round(0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2]);
          sum += gray;
          count++;
        }
      }
      
      thresholds[by][bx] = sum / count;
    }
  }
  
  // Apply thresholding
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const by = Math.floor(y / blockSize);
      const bx = Math.floor(x / blockSize);
      const threshold = thresholds[by][bx];
      
      const index = (y * width + x) * 4;
      const gray = Math.round(0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2]);
      const binary = gray > threshold ? 255 : 0;
      
      data[index] = binary;
      data[index + 1] = binary;
      data[index + 2] = binary;
    }
  }
  
  return imageData;
}

/**
 * Binarization with multiple methods
 */
function binarizeImage(
  imageData: ImageData, 
  method: 'otsu' | 'adaptive' | 'threshold' = 'otsu',
  manualThreshold: number = 128
): ImageData {
  if (method === 'adaptive') {
    return adaptiveBinarize(imageData);
  }
  
  const data = imageData.data;
  const histogram = new Array(256).fill(0);
  
  // Build histogram
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    histogram[gray]++;
  }
  
  // Calculate threshold
  const threshold = method === 'otsu' 
    ? calculateOtsuThreshold(histogram, imageData.width * imageData.height)
    : manualThreshold;
  
  console.log(`[PdfProcessor] Binarization threshold: ${threshold} (method: ${method})`);
  
  // Apply threshold
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    const binary = gray > threshold ? 255 : 0;
    data[i] = binary;
    data[i + 1] = binary;
    data[i + 2] = binary;
  }
  
  return imageData;
}

/**
 * Intelligent scaling to fit within maximum dimensions
 */
function scaleImageToFit(
  canvas: HTMLCanvasElement, 
  maxDimension: number,
  preserveAspectRatio: boolean = true
): HTMLCanvasElement {
  const { width, height } = canvas;
  
  if (width <= maxDimension && height <= maxDimension) {
    return canvas;
  }
  
  let newWidth: number;
  let newHeight: number;
  
  if (preserveAspectRatio) {
    const scale = Math.min(maxDimension / width, maxDimension / height);
    newWidth = Math.floor(width * scale);
    newHeight = Math.floor(height * scale);
  } else {
    newWidth = Math.min(width, maxDimension);
    newHeight = Math.min(height, maxDimension);
  }
  
  console.log(`[PdfProcessor] Scaling from ${width}x${height} to ${newWidth}x${newHeight}`);
  
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = newWidth;
  scaledCanvas.height = newHeight;
  const ctx = scaledCanvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get 2D context for scaling');
  }
  
  // Use high-quality scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, newWidth, newHeight);
  
  return scaledCanvas;
}

/**
 * Apply full preprocessing pipeline to canvas
 */
function preprocessCanvas(
  canvas: HTMLCanvasElement, 
  config: PreprocessingConfig
): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context for preprocessing');
  }
  
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  console.log(`[PdfProcessor] Preprocessing: ${canvas.width}x${canvas.height}`);
  
  // Apply filters in sequence
  if (config.enhanceContrast) {
    console.log(`[PdfProcessor]   - Enhancing contrast (factor: ${config.contrastFactor})...`);
    imageData = enhanceContrast(imageData, config.contrastFactor);
  }
  
  if (config.denoise) {
    console.log('[PdfProcessor]   - Reducing noise...');
    imageData = denoiseImage(imageData);
  }
  
  if (config.sharpen) {
    console.log(`[PdfProcessor]   - Sharpening (${config.sharpenStrength})...`);
    imageData = sharpenImage(imageData, config.sharpenStrength);
  }
  
  if (config.binarize) {
    console.log(`[PdfProcessor]   - Binarizing (${config.binarizeMethod})...`);
    imageData = binarizeImage(imageData, config.binarizeMethod, config.binarizeThreshold);
  }
  
  // Write processed data back to canvas
  ctx.putImageData(imageData, 0, 0);
  
  // Scale to fit
  return scaleImageToFit(canvas, config.maxDimension, config.preserveAspectRatio);
}

// ==================== MAIN PDF PROCESSING ====================

/**
 * Rasterize PDF pages to optimized images
 * 
 * @param fileBuffer - PDF file as ArrayBuffer
 * @param config - Preprocessing configuration
 * @returns Array of base64-encoded image parts
 */
export async function rasterizePdfToParts(
  fileBuffer: ArrayBuffer,
  config: Partial<PreprocessingConfig> = {}
): Promise<Part[]> {
  const startTime = Date.now();
  const finalConfig: PreprocessingConfig = { ...DEFAULT_CONFIG, ...config };
  const imageParts: Part[] = [];
  const stats: ProcessingStats = {
    totalPages: 0,
    processedPages: 0,
    totalSizeKB: 0,
    averageSizeKB: 0,
    processingTimeMs: 0,
    errorCount: 0,
    warnings: [],
  };
  
  try {
    console.log('[PdfProcessor] ========================================');
    console.log('[PdfProcessor] Starting PDF Processing');
    console.log('[PdfProcessor] ========================================');
    
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(fileBuffer) });
    const pdfProxy = await loadingTask.promise;

    const pagesToProcess = Math.min(pdfProxy.numPages, 10);
    stats.totalPages = pdfProxy.numPages;
    
    console.log(`[PdfProcessor] PDF: ${pdfProxy.numPages} pages, processing ${pagesToProcess}`);
    console.log(`[PdfProcessor] Config:`, JSON.stringify(finalConfig, null, 2));

    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      try {
        const page = await pdfProxy.getPage(pageNum);
        const viewport = page.getViewport({ scale: finalConfig.scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');

        if (!context) {
          console.error(`[PdfProcessor] Page ${pageNum}: Failed to get 2D context`);
          stats.errorCount++;
          continue;
        }

        console.log(`[PdfProcessor] Page ${pageNum}: Rendering at ${canvas.width}x${canvas.height}`);

        await page.render({
          canvasContext: context,
          viewport: viewport,
          canvas
        } as any).promise;

        // Apply preprocessing
        const processedCanvas = preprocessCanvas(canvas, finalConfig);

        // Convert to base64
        const mimeType = `image/${finalConfig.format}`;
        const base64Url = processedCanvas.toDataURL(mimeType, finalConfig.quality);
        const base64Data = base64Url.split(',')[1];
        
        const sizeKB = Math.round((base64Data.length * 3) / 4 / 1024);
        stats.totalSizeKB += sizeKB;
        stats.processedPages++;
        
        console.log(`[PdfProcessor] Page ${pageNum}: Encoded as ${sizeKB}KB ${finalConfig.format.toUpperCase()}`);
        
        imageParts.push({ 
          inlineData: { 
            data: base64Data, 
            mimeType: mimeType
          } 
        });
        
      } catch (error) {
        console.error(`[PdfProcessor] Page ${pageNum}: Processing error:`, error);
        stats.errorCount++;
        stats.warnings.push(`Page ${pageNum} failed: ${error}`);
      }
    }

    stats.processingTimeMs = Date.now() - startTime;
    stats.averageSizeKB = stats.processedPages > 0 
      ? Math.round(stats.totalSizeKB / stats.processedPages) 
      : 0;
    
    console.log('[PdfProcessor] ========================================');
    console.log('[PdfProcessor] Processing Complete');
    console.log(`[PdfProcessor] Pages: ${stats.processedPages}/${stats.totalPages}`);
    console.log(`[PdfProcessor] Total Size: ${stats.totalSizeKB}KB`);
    console.log(`[PdfProcessor] Average: ${stats.averageSizeKB}KB per image`);
    console.log(`[PdfProcessor] Time: ${stats.processingTimeMs}ms`);
    console.log(`[PdfProcessor] Errors: ${stats.errorCount}`);
    console.log('[PdfProcessor] ========================================');
    
    if (stats.warnings.length > 0) {
      console.warn('[PdfProcessor] Warnings:', stats.warnings);
    }
    
  } catch (error) {
    console.error("[PdfProcessor] Fatal error:", error);
    throw error;
  }

  return imageParts;
}

// ==================== PRESET CONFIGURATIONS ====================

/**
 * Optimized presets for different blueprint types
 */
export const PRESETS = {
  /**
   * For scanned paper blueprints with potential degradation
   */
  SCANNED_BLUEPRINT: {
    scale: 4.0,
    enhanceContrast: true,
    contrastFactor: 1.6,
    sharpen: true,
    sharpenStrength: 'medium' as const,
    denoise: true,
    binarize: false,
    binarizeMethod: 'otsu' as const,
    binarizeThreshold: 128,
    quality: 0.90,
    format: 'jpeg' as const,
    maxDimension: 4096,
    preserveAspectRatio: true,
  },
  
  /**
   * For clean CAD-generated blueprints
   */
  CAD_BLUEPRINT: {
    scale: 3.0,
    enhanceContrast: true,
    contrastFactor: 1.5,
    sharpen: false,
    sharpenStrength: 'light' as const,
    denoise: false,
    binarize: true,
    binarizeMethod: 'otsu' as const,
    binarizeThreshold: 128,
    quality: 0.85,
    format: 'jpeg' as const,
    maxDimension: 4096,
    preserveAspectRatio: true,
  },
  
  /**
   * For heavily degraded or low-quality scans
   */
  DEGRADED_BLUEPRINT: {
    scale: 4.5,
    enhanceContrast: true,
    contrastFactor: 1.8,
    sharpen: true,
    sharpenStrength: 'strong' as const,
    denoise: true,
    binarize: true,
    binarizeMethod: 'adaptive' as const,
    binarizeThreshold: 128,
    quality: 0.90,
    format: 'jpeg' as const,
    maxDimension: 4096,
    preserveAspectRatio: true,
  },
  
  /**
   * Fast processing with minimal preprocessing
   */
  FAST: {
    scale: 2.0,
    enhanceContrast: true,
    contrastFactor: 1.3,
    sharpen: false,
    sharpenStrength: 'light' as const,
    denoise: false,
    binarize: false,
    binarizeMethod: 'otsu' as const,
    binarizeThreshold: 128,
    quality: 0.75,
    format: 'jpeg' as const,
    maxDimension: 3072,
    preserveAspectRatio: true,
  },
  
  /**
   * High-quality processing for critical analysis
   */
  HIGH_QUALITY: {
    scale: 5.0,
    enhanceContrast: true,
    contrastFactor: 1.5,
    sharpen: true,
    sharpenStrength: 'medium' as const,
    denoise: true,
    binarize: false,
    binarizeMethod: 'otsu' as const,
    binarizeThreshold: 128,
    quality: 0.95,
    format: 'png' as const,
    maxDimension: 5120,
    preserveAspectRatio: true,
  },
} as const;

/**
 * Get recommended preset based on blueprint characteristics
 */
export function getRecommendedPreset(characteristics: {
  isScanned: boolean;
  quality: 'low' | 'medium' | 'high';
  urgency: 'low' | 'medium' | 'high';
}): PreprocessingConfig {
  const { isScanned, quality, urgency } = characteristics;
  
  if (urgency === 'high') {
    return PRESETS.FAST;
  }
  
  if (quality === 'low') {
    return PRESETS.DEGRADED_BLUEPRINT;
  }
  
  if (isScanned && quality === 'medium') {
    return PRESETS.SCANNED_BLUEPRINT;
  }
  
  if (!isScanned) {
    return PRESETS.CAD_BLUEPRINT;
  }
  
  return PRESETS.HIGH_QUALITY;
}