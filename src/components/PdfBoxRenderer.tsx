import React, { useEffect, useRef, useCallback } from 'react';
import { BoundingBox, VariableField } from '../types/pdfTypes';
import { normalizeCoordinates } from '../utils/pdfUtils';

interface PdfBoxRendererProps {
  parsedResults: any;
  currentPage: number;
  scale: number;
  selectedBox: BoundingBox | null;
  variableFields: VariableField[];
  variableMappings: any[];
  unmappedBoxIds: string[];
  showVariables: boolean;
  onCanvasMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onCanvasMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onCanvasMouseUp: () => void;
  onCanvasMouseLeave: () => void;
}

const PdfBoxRenderer: React.FC<PdfBoxRendererProps> = ({
  parsedResults,
  currentPage,
  scale,
  selectedBox,
  variableFields,
  variableMappings,
  unmappedBoxIds,
  showVariables,
  onCanvasMouseDown,
  onCanvasMouseMove,
  onCanvasMouseUp,
  onCanvasMouseLeave
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Render bounding boxes function
  const renderBoundingBoxes = useCallback(() => {
    if (!parsedResults || !canvasRef.current || !containerRef.current) return;
    
    const pageElement = containerRef.current.querySelector('.react-pdf__Page');
    if (!pageElement) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Get the dimensions of the PDF page
    const { width, height } = pageElement.getBoundingClientRect();
    
    // Set canvas dimensions to match the page
    canvas.width = width;
    canvas.height = height;
    
    // Clear previous drawings
    ctx.clearRect(0, 0, width, height);
    
    // Find page data that contains boxes for the current page
    const currentPageBoxes = parsedResults.pages
      .flatMap((page: any) => page.boxes)
      .filter((box: any) => box.page === currentPage);
    
    if (currentPageBoxes.length === 0) return;
    
    if (showVariables && variableMappings.length > 0) {
      // Draw variable fields instead of bounding boxes
      currentPageBoxes.forEach((box: BoundingBox) => {
        // Check if this box has a variable mapping
        const field = variableFields.find(field => field.boxId === box.id);
        
        // Normalize coordinates for this box
        const { x, y, width: boxWidth, height: boxHeight } = normalizeCoordinates(box, width, height, scale);
        
        if (field) {
          // This box has a mapped variable - draw with green fill and the variable value
          ctx.strokeStyle = 'rgba(0, 150, 0, 0.8)';
          ctx.lineWidth = 2;
          ctx.fillStyle = 'rgba(0, 150, 0, 0.2)';
          
          // Draw the rectangle
          ctx.strokeRect(x, y, boxWidth, boxHeight);
          ctx.fillRect(x, y, boxWidth, boxHeight);
          
          // Draw the variable value text
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.font = `${Math.max(12, boxHeight * 0.6)}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Draw text or placeholder
          const text = field.value || `[${field.name}]`;
          ctx.fillText(text, x + boxWidth / 2, y + boxHeight / 2, boxWidth * 0.9);
        } else if (unmappedBoxIds.includes(box.id || '')) {
          // Unmapped box - show with red outline as before
          if (selectedBox && selectedBox.id === box.id) {
            ctx.strokeStyle = 'rgba(0, 128, 255, 1)';
            ctx.lineWidth = 3;
            ctx.fillStyle = 'rgba(0, 128, 255, 0.3)';
          } else {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.lineWidth = 2;
            ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
          }
          
          ctx.strokeRect(x, y, boxWidth, boxHeight);
          ctx.fillRect(x, y, boxWidth, boxHeight);
        }
      });
    } else {
      // Draw regular bounding boxes 
      currentPageBoxes.forEach((box: BoundingBox) => {
        // Normalize coordinates
        const { x, y, width: boxWidth, height: boxHeight } = normalizeCoordinates(box, width, height, scale);
        
        // Set styles based on selection status
        if (selectedBox && selectedBox.id === box.id) {
          ctx.strokeStyle = 'rgba(0, 128, 255, 1)'; // Bright blue for selected box
          ctx.lineWidth = 3;
          ctx.fillStyle = 'rgba(0, 128, 255, 0.3)';
        } else {
          ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
          ctx.lineWidth = 2;
          ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        }
        
        // Draw the rectangle
        ctx.strokeRect(x, y, boxWidth, boxHeight);
        ctx.fillRect(x, y, boxWidth, boxHeight);
      });
    }
  }, [parsedResults, currentPage, scale, selectedBox, variableFields, variableMappings, unmappedBoxIds, showVariables]);

  // Effect for rendering bounding boxes
  useEffect(() => {
    if (parsedResults && canvasRef.current && containerRef.current) {
      const pageElement = containerRef.current.querySelector('.react-pdf__Page');
      if (pageElement) {
        renderBoundingBoxes();
      }
    }
  }, [parsedResults, currentPage, scale, selectedBox, renderBoundingBoxes]);
  
  // Re-render when page loads
  const onPageRender = useCallback(() => {
    if (parsedResults && containerRef.current) {
      const pageElement = containerRef.current.querySelector('.react-pdf__Page');
      if (pageElement) {
        setTimeout(() => renderBoundingBoxes(), 100);
      }
    }
  }, [parsedResults, renderBoundingBoxes]);

  useEffect(() => {
    // Add a callback for when the page renders
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          onPageRender();
        }
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current, { childList: true, subtree: true });
    }

    return () => {
      observer.disconnect();
    };
  }, [onPageRender]);

  return (
    <div ref={containerRef}>
      {/* This will wrap the PDF Page but without rendering it directly */}
      <div className="pdf-canvas-container">
        <canvas 
          ref={canvasRef} 
          className="bounding-boxes-overlay"
          onMouseDown={onCanvasMouseDown}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={onCanvasMouseUp}
          onMouseLeave={onCanvasMouseLeave}
        />
      </div>
    </div>
  );
};

export default PdfBoxRenderer;