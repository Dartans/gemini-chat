import { BoundingBox } from '../types/pdfTypes';

/**
 * Normalize coordinates from PDF space (0-1000) to canvas space
 */
export const normalizeCoordinates = (box: BoundingBox, pageWidth: number, pageHeight: number, scale: number = 1.0) => {
  return {
    x: (box.x / 1000) * pageWidth * scale,
    y: (box.y / 1000) * pageHeight * scale,
    width: (box.width / 1000) * pageWidth * scale,
    height: (box.height / 1000) * pageHeight * scale
  };
};

/**
 * Convert coordinates from canvas space to PDF space (0-1000)
 */
export const denormalizeCoordinates = (
  x: number, y: number, width: number, height: number, 
  pageWidth: number, pageHeight: number,
  scale: number = 1.0
) => {
  return {
    x: Math.round((x / scale) / pageWidth * 1000),
    y: Math.round((y / scale) / pageHeight * 1000),
    width: Math.round((width / scale) / pageWidth * 1000),
    height: Math.round((height / scale) / pageHeight * 1000)
  };
};

/**
 * Load a PDF file from base64 data
 */
export const loadPdfFromBase64 = (base64Data: string, fileName: string): File => {
  // Convert base64 back to blob
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'application/pdf' });
  
  // Create a File object from the blob
  return new File([blob], fileName, { type: 'application/pdf' });
};