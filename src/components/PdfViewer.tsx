import React, { useRef, useEffect } from "react";
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './PdfViewer.css';
import { BoundingBox, VariableField } from '../types/pdfTypes';
import { normalizeCoordinates } from '../utils/pdfCoordinateUtils';

// Define proper TypeScript props interface
interface PdfViewerProps {
  pdf: string | File; // URL or File object
  onCancel: () => void;
  visible: boolean;
  boundingBoxes?: BoundingBox[]; // Array of bounding boxes to draw
  filledFormData?: VariableField[]; // Filled form data to display in boxes
  currentPage?: number; // Current page number from parent component
  scale?: number; // Scale from parent component
}

const PdfViewer: React.FC<PdfViewerProps> = ({ 
  pdf, 
  onCancel, 
  visible, 
  boundingBoxes = [], 
  filledFormData = [],
  currentPage = 1,
  scale = 1
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  
  const onDocumentError = (err: Error) => {
    console.error('PDF viewer error:', err);
  };

  // Function to render bounding boxes on the canvas
  const renderBoundingBoxes = () => {
    if (!canvasRef.current || !pageRef.current) return;
    
    const canvas = canvasRef.current;
    const pageElement = pageRef.current.querySelector('.react-pdf__Page');
    if (!pageElement) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Get the dimensions of the PDF page
    const { width, height } = pageElement.getBoundingClientRect();
    
    // Set canvas dimensions to match the page
    canvas.width = width;
    canvas.height = height;
    
    // Clear previous drawings
    ctx.clearRect(0, 0, width, height);
    
    // Filter boxes for current page only
    const currentPageBoxes = boundingBoxes.filter(box => box.page === currentPage);
    if (currentPageBoxes.length === 0) return;
    
    // Draw each box
    currentPageBoxes.forEach(box => {
      // Normalize coordinates for this box
      const { x, y, width: boxWidth, height: boxHeight } = normalizeCoordinates(box, width, height, scale);
      
      // Find if this box has filled form data
      const filledData = filledFormData.find(field => field.boxId === box.id);
      
      if (filledData) {
        // This box has filled data - draw with green fill and the value
        ctx.strokeStyle = 'rgba(0, 150, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(0, 150, 0, 0.2)';
        
        // Draw the rectangle
        ctx.strokeRect(x, y, boxWidth, boxHeight);
        ctx.fillRect(x, y, boxWidth, boxHeight);
        
        // Draw the filled value text
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.font = `${Math.max(12, boxHeight * 0.6)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Draw text or placeholder
        const text = filledData.value || `[${filledData.name}]`;
        ctx.fillText(text, x + boxWidth / 2, y + boxHeight / 2, boxWidth * 0.9);
      } else {
        // Regular bounding box - draw with red outline
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        
        // Draw the rectangle
        ctx.strokeRect(x, y, boxWidth, boxHeight);
        ctx.fillRect(x, y, boxWidth, boxHeight);
      }
    });
  };

  // Re-render when page changes, scale changes, or boxes/form data updates
  useEffect(() => {
    if (visible) {
      // We need to wait a bit for the PDF to render before drawing boxes
      const timer = setTimeout(() => {
        renderBoundingBoxes();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentPage, scale, boundingBoxes, filledFormData, visible]);

  // Add observer for PDF page rendering completion
  useEffect(() => {
    if (!visible || !pageRef.current) return;

    const observer = new MutationObserver(() => {
      renderBoundingBoxes();
    });

    observer.observe(pageRef.current, { childList: true, subtree: true });
    
    return () => {
      observer.disconnect();
    };
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <div className="pdf-viewer-modal">
      <div className="pdf-viewer-overlay" onClick={onCancel}></div>
      <div className="pdf-viewer-content">
        <button className="pdf-viewer-close" onClick={onCancel}>×</button>
        
        <div className="pdf-viewer-document">
          <div ref={pageRef} className="pdf-page-container">
            <Document
              file={pdf}
              onLoadError={onDocumentError}
              error="Failed to load PDF"
            >
              <Page 
                pageNumber={currentPage}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </Document>
            <canvas ref={canvasRef} className="pdf-viewer-canvas"></canvas>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfViewer;