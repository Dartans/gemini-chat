import React, { useRef, useEffect } from 'react';
import { Document, Page } from 'react-pdf';
import './PdfViewer.css';
import { configurePdfWorker } from '../../utils/pdfJsWorkerUtils';
import { pdfjs } from 'react-pdf';

// Configure PDF.js worker when the component is imported
configurePdfWorker(pdfjs);

interface PdfViewerProps {
  pdfUrl: string;
  currentPage: number;
  scale: number;
  onDocumentLoadSuccess: ({ numPages }: { numPages: number }) => void;
  onPageRenderSuccess?: () => void;
  children?: React.ReactNode; // To allow overlaying canvas
}

const PdfViewer: React.FC<PdfViewerProps> = ({
  pdfUrl,
  currentPage,
  scale,
  onDocumentLoadSuccess,
  onPageRenderSuccess,
  children
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Log when PDF loading is attempted
  useEffect(() => {
    if (pdfUrl) {
      console.log('PdfViewer: Attempting to load PDF from URL:', pdfUrl);
    } else {
      console.log('PdfViewer: No PDF URL provided');
    }
  }, [pdfUrl]);

  if (!pdfUrl) {
    return (
      <div className="pdf-viewer-wrapper">
        <div className="pdf-viewer">
          <div className="pdf-document-container empty-container" ref={containerRef}>
            <div className="pdf-empty-state">
              <h3>No PDF Loaded</h3>
              <p>Please upload a PDF file to begin</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-viewer-wrapper">
      <div className="pdf-viewer">
        <div className="pdf-document-container" ref={containerRef}>
          <Document
            file={pdfUrl}
            onLoadSuccess={(data) => {
              console.log('PdfViewer: PDF loaded successfully with', data.numPages, 'pages');
              onDocumentLoadSuccess(data);
            }}
            onLoadError={(error) => {
              console.error('PdfViewer: Error loading PDF:', error);
            }}
            error={<div className="pdf-error">Failed to load PDF. Please try again.</div>}
          >
            <Page 
              pageNumber={currentPage}
              scale={scale}
              onRenderSuccess={() => {
                console.log('PdfViewer: Page', currentPage, 'rendered successfully');
                if (onPageRenderSuccess) onPageRenderSuccess();
              }}
              onRenderError={(error) => {
                console.error('PdfViewer: Page render error:', error);
              }}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              error={<div className="page-error">Error rendering page.</div>}
            />
          </Document>
          {/* Render children (like the canvas overlay) */}
          {children}
        </div>
      </div>
    </div>
  );
};

export default PdfViewer;