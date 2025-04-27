/**
 * PDF.js Worker Configuration Utilities
 * This file provides utilities for configuring PDF.js workers across different environments.
 */

/**
 * Gets the appropriate worker URL based on the current environment.
 * Uses a stable version from unpkg that's known to work with react-pdf
 * 
 * @param pdfJsVersion The version of PDF.js being used
 * @returns The URL for the PDF.js worker
 */
export const getPdfWorkerUrl = (pdfJsVersion: string): string => {
  // Using unpkg CDN which has more consistent version availability
  // This version (3.11.174) is stable and works with react-pdf
  const unpkgWorkerUrl = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
  console.log(`Using PDF.js worker from unpkg: ${unpkgWorkerUrl}`);
  return unpkgWorkerUrl;
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
  
  // Set the worker source - using a fixed version that works instead of dynamic versioning
  pdfjs.GlobalWorkerOptions.workerSrc = getPdfWorkerUrl(pdfjs.version);
  
  console.log(`PDF.js Worker configured: ${pdfjs.GlobalWorkerOptions.workerSrc}`);
  
  // Force the worker source to use a specific version regardless of what react-pdf
  // or pdfjs-dist is trying to use
  try {
    // This makes sure we're using the same worker version throughout the app
    window['pdfWorkerSrc'] = getPdfWorkerUrl(pdfjs.version);
  } catch (e) {
    console.error('Could not set global PDF worker source:', e);
  }
};