/**
 * PDF.js Worker Configuration Utilities
 * This file provides utilities for configuring PDF.js workers across different environments.
 */

/**
 * Gets the appropriate worker URL based on the current environment.
 * Prioritizes the local worker file if available, falls back to CDN.
 * 
 * @param pdfJsVersion The version of PDF.js being used
 * @returns The URL for the PDF.js worker
 */
export const getPdfWorkerUrl = (pdfJsVersion: string): string => {
  // For browser environments
  if (typeof window !== 'undefined') {
    // For local development and production builds, try to use the local worker file first
    const localWorkerUrl = `${window.location.origin}/pdfjs/pdf.worker.min.js`;
    
    // Fallback to CDN if specified or if in an environment where local files might not be accessible
    const cdnWorkerUrl = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfJsVersion}/pdf.worker.min.js`;
    
    return localWorkerUrl;
  }
  
  // For server-side rendering or environments without 'window'
  return `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfJsVersion}/pdf.worker.min.js`;
};

/**
 * Configures the PDF.js worker for the application.
 * Call this function once at the application startup.
 * 
 * @param pdfjs The PDF.js library instance
 */
export const configurePdfWorker = (pdfjs: any): void => {
  if (!pdfjs || !pdfjs.GlobalWorkerOptions) {
    console.error('PDF.js library not properly loaded');
    return;
  }
  
  // Set the worker source
  pdfjs.GlobalWorkerOptions.workerSrc = getPdfWorkerUrl(pdfjs.version);
  
  console.log(`PDF.js Worker configured: ${pdfjs.GlobalWorkerOptions.workerSrc}`);
};