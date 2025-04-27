import React, { useRef } from 'react';
import { Document, Page } from 'react-pdf';
import './PdfViewer.css';

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

  return (
    <div className="pdf-viewer-wrapper">
      <div className="pdf-viewer">
        <div className="pdf-document-container" ref={containerRef}>
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            error="Failed to load PDF"
          >
            <Page 
              pageNumber={currentPage}
              scale={scale}
              onRenderSuccess={onPageRenderSuccess}
              renderTextLayer={false}
              renderAnnotationLayer={false}
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