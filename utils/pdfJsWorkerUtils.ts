import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { pdfjs } from 'react-pdf';

/**
 * PDF.js Worker Configuration Utilities
 * This file provides utilities for configuring PDF.js workers across different environments.
 */

// Extend Window interface to include our custom property using declaration merging
declare global {
  interface Window {
    pdfWorkerSrc?: string;
  }
}

/**
 * Gets the appropriate worker URL based on the current environment.
 * Uses the version specified in package.json (3.11.174)
 * 
 * @param pdfJsVersion The version of PDF.js being used
 * @returns The URL for the PDF.js worker
 */
export const getPdfWorkerUrl = (pdfJsVersion: string): string => {
  // Always use version 3.11.174 from package.json regardless of what's passed in
  const packageVersion = '3.11.174';
  const unpkgWorkerUrl = `https://unpkg.com/pdfjs-dist@${packageVersion}/build/pdf.worker.min.js`;
  console.log(`Using PDF.js worker from unpkg: ${unpkgWorkerUrl} (using package.json version)`);
  return unpkgWorkerUrl;
};

/**
 * Configures the PDF.js worker for the application.
 * Call this function once at the application startup.
 * 
 * @param pdfjs The PDF.js library instance
 */
export const configurePdfWorker = (pdfjs: any): void => {
  // Check if it's already configured
  if (pdfjs.GlobalWorkerOptions.workerSrc) {
    return;
  }

  // For production environment
  if (process.env.NODE_ENV === 'production') {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';
  } else {
    // For development environment
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
  }

  console.log(`PDF.js Worker configured: ${pdfjs.GlobalWorkerOptions.workerSrc}`);
  
  // Force the worker source to use a specific version regardless of what react-pdf
  // or pdfjs-dist is trying to use
  try {
    // This makes sure we're using the same worker version throughout the app
    window.pdfWorkerSrc = getPdfWorkerUrl(pdfjs.version);
  } catch (e) {
    console.error('Could not set global PDF worker source:', e);
  }
};