/**
 * PDF.js initialization and configuration
 */

// If pdfjsLib isn't loaded yet, create a stub
if (typeof pdfjsLib === 'undefined') {
  window.pdfjsLib = window.pdfjsLib || {};
}

// Set the worker source path - using package.json version (3.11.174)
if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions?.workerSrc) {
  window.pdfjsLib.GlobalWorkerOptions = window.pdfjsLib.GlobalWorkerOptions || {};
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
}

// Handle any initialization errors
window.addEventListener('error', function(event) {
  if (event.message && (
      event.message.includes('Failed to construct \'Headers\'') || 
      event.message.includes('message channel closed'))) {
    console.warn('PDF.js initialization error handled:', event.message);
    event.preventDefault();
    event.stopPropagation();
  }
}, true);