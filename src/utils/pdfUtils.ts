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

/**
 * Convert a File object to a Base64 string
 * @param file The file to convert
 * @returns Promise resolving to a Base64 string
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Remove data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to convert file to Base64'));
      }
    };
    reader.onerror = error => reject(error);
  });
};

/**
 * Convert a Base64 string to a Blob object
 * @param base64 The Base64 string to convert
 * @param type The MIME type of the file
 * @returns A Blob object
 */
export const base64ToBlob = (base64: string, type: string): Blob => {
  const byteCharacters = atob(base64);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
    const slice = byteCharacters.slice(offset, offset + 1024);
    const byteNumbers = new Array(slice.length);
    
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type });
};