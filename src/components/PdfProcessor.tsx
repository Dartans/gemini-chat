import React, { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { GoogleGenAI } from '@google/genai';
import { pdfjs, Document, Page } from 'react-pdf';
import useCookie from '../hooks/useCookie';
import { processPdfWithGemini } from '../services/aiService';
import { BoundingBox, PdfResults } from '../types/pdfTypes';
import './PdfProcessor.css';

// Configure pdf.js worker using import.meta.url for better module resolution
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface PdfProcessorProps {
  onClose: () => void;
  onBoxesLoaded?: (boxes: BoundingBox[], selectedBox: BoundingBox | null) => void;
  onPageChange?: (pageNumber: number, totalPages: number) => void;
  onBoxSelect?: (box: BoundingBox | null) => void;
  onCoordinateChange?: (field: 'x' | 'y' | 'width' | 'height', value: string, selectedBox: BoundingBox | null) => void;
  externalControls?: boolean;
  loadedPdfData?: {
    id: string;
    fileName: string;
    data: any;
    pdfData: string;
  };
}

// Export a ref interface
export interface PdfProcessorRef {
  selectBoxById: (boxId: string | null) => void;
  handlePageChange: (newPage: number) => void;
  handleCoordinateChange: (field: 'x' | 'y' | 'width' | 'height', value: string) => void;
  getCurrentPage: () => number;
  getTotalPages: () => number;
  getAllBoxes: () => BoundingBox[];
  getSelectedBox: () => BoundingBox | null;
}

const PdfProcessor = forwardRef<PdfProcessorRef, PdfProcessorProps>((props, ref) => {
  const { 
    onClose,
    onBoxesLoaded,
    onPageChange,
    onBoxSelect,
    onCoordinateChange,
    externalControls = false
  } = props;
  
  const [apiKey] = useCookie('geminiApiKey');
  // Add cookie state to save bounding box data
  const [pdfBoundingBoxes, setPdfBoundingBoxes] = useCookie('pdfBoundingBoxes', '{}');
  const [savedPdfs, setSavedPdfs] = useCookie('savedPdfs', '[]');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rawPdfData, setRawPdfData] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rawResults, setRawResults] = useState<string | null>(null);
  const [parsedResults, setParsedResults] = useState<PdfResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  
  // Box selection and movement states
  const [selectedBox, setSelectedBox] = useState<BoundingBox | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);

  // Handle file change with base64 PDF storage
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      setFile(selectedFile);
      const objectUrl = URL.createObjectURL(selectedFile);
      setPdfUrl(objectUrl);
      setError(null);
      setRawResults(null);
      setParsedResults(null);
      setSelectedBox(null);
      
      // Read the PDF file as base64 for storage
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target && e.target.result) {
          // Get base64 string (remove metadata prefix)
          const base64String = e.target.result.toString().split(',')[1];
          setRawPdfData(base64String);
        }
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  // Process file updated to notify parent when results are ready
  const processFile = async () => {
    if (!file || !apiKey) {
      setError("Missing file or API key");
      return;
    }

    setIsProcessing(true);
    setError(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const uploadedFile = await ai.files.upload({
        file: file,
      });

      if (!uploadedFile.uri || !uploadedFile.mimeType) {
        setError("Failed to upload file or get file details.");
        setIsProcessing(false);
        return;
      }
      
      const result = await processPdfWithGemini(
        apiKey, 
        uploadedFile.uri, 
        uploadedFile.mimeType
      );
      
      setRawResults(result || "No results returned");
      
      if (result) {
        try {
          const parsedData = JSON.parse(result) as PdfResults;
          
          // Add unique ids to each bounding box
          const processedData = {
            pages: parsedData.pages.map(page => ({
              boxes: page.boxes.map((box, index) => ({
                ...box,
                id: `box-${page.boxes[0]?.page || 0}-${index}`,
              }))
            }))
          };
          
          setParsedResults(processedData);
          
          // Notify parent component about loaded boxes if callback provided
          if (onBoxesLoaded && externalControls) {
            const allBoxes = processedData.pages.flatMap(page => page.boxes);
            onBoxesLoaded(allBoxes, null);
          }
        } catch (parseError) {
          console.error("Error parsing results:", parseError);
          setError("Failed to parse results as JSON.");
        }
      }
    } catch (err) {
      console.error("Error processing PDF:", err);
      setError(`Error processing PDF: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Effect for rendering bounding boxes (unchanged)
  useEffect(() => {
    if (parsedResults && canvasRef.current) {
      const pageElement = pageRef.current?.querySelector('.react-pdf__Page');
      if (pageElement) {
        renderBoundingBoxes(pageElement);
      }
    }
  }, [parsedResults, currentPage, scale, selectedBox]);
  
  // Effect to load saved PDF data when provided through props
  useEffect(() => {
    if (props.loadedPdfData && props.loadedPdfData.pdfData) {
      try {
        // Convert base64 back to blob
        const byteCharacters = atob(props.loadedPdfData.pdfData);
        const byteNumbers = new Array(byteCharacters.length);
        
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        
        // Create a File object from the blob
        const pdfFile = new File([blob], props.loadedPdfData.fileName, { type: 'application/pdf' });
        
        // Set the file and create object URL
        setFile(pdfFile);
        const objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
        setRawPdfData(props.loadedPdfData.pdfData);
        
        // Set the parsed results directly (no need to process the PDF again)
        setParsedResults(props.loadedPdfData.data);
        
        // Notify parent component about loaded boxes if callback provided
        if (onBoxesLoaded && externalControls) {
          const allBoxes = props.loadedPdfData.data.pages.flatMap((page: any) => page.boxes);
          onBoxesLoaded(allBoxes, null);
        }
      } catch (err) {
        setError(`Error loading saved PDF: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }, [props.loadedPdfData, onBoxesLoaded, externalControls]);
  
  // Updated document load success handler to notify parent
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setCurrentPage(1);
    
    // Notify parent component if needed
    if (onPageChange && externalControls) {
      onPageChange(1, numPages);
    }
  };

  // Helper function (unchanged)
  const normalizeCoordinates = (box: BoundingBox, pageWidth: number, pageHeight: number) => {
    return {
      x: (box.x / 1000) * pageWidth * scale,
      y: (box.y / 1000) * pageHeight * scale,
      width: (box.width / 1000) * pageWidth * scale,
      height: (box.height / 1000) * pageHeight * scale
    };
  };

  // Helper function (unchanged)
  const denormalizeCoordinates = (
    x: number, y: number, width: number, height: number, 
    pageWidth: number, pageHeight: number
  ) => {
    return {
      x: Math.round((x / scale) / pageWidth * 1000),
      y: Math.round((y / scale) / pageHeight * 1000),
      width: Math.round((width / scale) / pageWidth * 1000),
      height: Math.round((height / scale) / pageHeight * 1000)
    };
  };

  // Bounding box rendering (unchanged)
  const renderBoundingBoxes = useCallback((pageElement: Element) => {
    if (!parsedResults || !canvasRef.current || !currentPage) return;
    
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
      .flatMap(page => page.boxes)
      .filter(box => box.page === currentPage);
    
    if (currentPageBoxes.length === 0) return;
    
    // Draw boxes
    currentPageBoxes.forEach(box => {
      // Normalize coordinates
      const { x, y, width: boxWidth, height: boxHeight } = normalizeCoordinates(box, width, height);
      
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
  }, [parsedResults, currentPage, scale, selectedBox]);

  // Page render callback (unchanged)
  const onPageRender = useCallback(() => {
    if (parsedResults && pageRef.current) {
      const pageElement = pageRef.current.querySelector('.react-pdf__Page');
      if (pageElement) {
        setTimeout(() => renderBoundingBoxes(pageElement), 100);
      }
    }
  }, [parsedResults, renderBoundingBoxes]);

  // Update page with notification to parent
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    if (onPageChange && externalControls) {
      onPageChange(newPage, numPages);
    }
  };

  // Update box selection with notification to parent
  const handleBoxSelection = (box: BoundingBox | null) => {
    setSelectedBox(box);
    if (onBoxSelect && externalControls) {
      onBoxSelect(box);
    }
  };

  // Handle mouse down with updated selection handler
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!parsedResults || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const pageElement = pageRef.current?.querySelector('.react-pdf__Page');
    if (!pageElement) return;
    
    const { width, height } = pageElement.getBoundingClientRect();
    
    const currentPageBoxes = parsedResults.pages
      .flatMap(page => page.boxes)
      .filter(box => box.page === currentPage);
    
    let foundBox = null;
    for (const box of currentPageBoxes) {
      const { x, y, width: boxWidth, height: boxHeight } = normalizeCoordinates(box, width, height);
      if (
        mouseX >= x && 
        mouseX <= x + boxWidth && 
        mouseY >= y && 
        mouseY <= y + boxHeight
      ) {
        foundBox = box;
        break;
      }
    }
    
    if (foundBox) {
      handleBoxSelection(foundBox);
      setIsDragging(true);
      setDragStart({ x: mouseX, y: mouseY });
      
      // No need to set pointer-events as we're keeping it as 'auto'
    } else {
      handleBoxSelection(null);
    }
  };

  // Handle mouse move (dragging) with updated selection
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !selectedBox || !dragStart || !canvasRef.current || !parsedResults) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const deltaX = mouseX - dragStart.x;
    const deltaY = mouseY - dragStart.y;
    
    setDragStart({ x: mouseX, y: mouseY });
    
    const pageElement = pageRef.current?.querySelector('.react-pdf__Page');
    if (!pageElement) return;
    const { width, height } = pageElement.getBoundingClientRect();
    
    const normalizedDeltaX = (deltaX / scale) / width * 1000;
    const normalizedDeltaY = (deltaY / scale) / height * 1000;
    
    const updatedResults = JSON.parse(JSON.stringify(parsedResults)) as PdfResults;
    
    updatedResults.pages.forEach(page => {
      page.boxes = page.boxes.map(box => {
        if (box.id === selectedBox.id) {
          return {
            ...box,
            x: box.x + normalizedDeltaX,
            y: box.y + normalizedDeltaY
          };
        }
        return box;
      });
    });
    
    setParsedResults(updatedResults);
    
    const updatedBox = updatedResults.pages
      .flatMap(page => page.boxes)
      .find(box => box.id === selectedBox.id);
    
    if (updatedBox) {
      handleBoxSelection(updatedBox);
    }
  };

  // Handle mouse up and leave handlers 
  const handleCanvasMouseUp = () => {
    setIsDragging(false);
    // No need to change pointer-events since we're keeping it as 'auto'
  };

  const handleCanvasMouseLeave = () => {
    setIsDragging(false);
    // No need to change pointer-events since we're keeping it as 'auto'
  };

  // Handle coordinate change with notification to parent
  const handleCoordinateChange = (
    field: 'x' | 'y' | 'width' | 'height',
    value: string
  ) => {
    if (!selectedBox || !parsedResults) return;
    
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) return;
    
    const updatedResults = JSON.parse(JSON.stringify(parsedResults)) as PdfResults;
    
    updatedResults.pages.forEach(page => {
      page.boxes = page.boxes.map(box => {
        if (box.id === selectedBox.id) {
          return {
            ...box,
            [field]: numValue
          };
        }
        return box;
      });
    });
    
    setParsedResults(updatedResults);
    
    const updatedBox = updatedResults.pages
      .flatMap(page => page.boxes)
      .find(box => box.id === selectedBox.id);
    
    if (updatedBox) {
      handleBoxSelection(updatedBox);
      
      // Notify parent if needed
      if (onCoordinateChange && externalControls) {
        onCoordinateChange(field, value, updatedBox);
      }
    }
  };

  // Method for external components to select a box by ID
  const selectBoxById = (boxId: string | null) => {
    if (!boxId || !parsedResults) {
      handleBoxSelection(null);
      return;
    }
    
    const boxToSelect = parsedResults.pages
      .flatMap(page => page.boxes)
      .find(box => box.id === boxId);
    
    if (boxToSelect) {
      if (boxToSelect.page !== currentPage) {
        handlePageChange(boxToSelect.page);
        setTimeout(() => handleBoxSelection(boxToSelect), 100);
      } else {
        handleBoxSelection(boxToSelect);
      }
    }
  };

  // Expose methods to parent component through ref
  useImperativeHandle(ref, () => ({
    selectBoxById,
    handlePageChange,
    handleCoordinateChange,
    getCurrentPage: () => currentPage,
    getTotalPages: () => numPages,
    getAllBoxes: () => parsedResults ? parsedResults.pages.flatMap(page => page.boxes) : [],
    getSelectedBox: () => selectedBox
  }));

  // Function to save bounding box data to a local JSON file
  const saveBoundingBoxData = () => {
    if (!parsedResults || !rawPdfData || !file) {
      setError("Missing PDF data or bounding boxes to save");
      return;
    }

    // Create unique ID for this saved PDF
    const pdfId = `pdf-${new Date().getTime()}`;
    
    // Create data object with PDF filename and bounding boxes
    const boundingBoxData = {
      id: pdfId,
      fileName: file.name,
      timestamp: new Date().toISOString(),
      data: parsedResults,
      pdfData: rawPdfData
    };

    try {
      // Convert data to JSON string
      const jsonData = JSON.stringify(boundingBoxData, null, 2);
      
      // Create a blob with the JSON data
      const blob = new Blob([jsonData], { type: 'application/json' });
      
      // Create a download link and trigger the download
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(blob);
      downloadLink.download = `${file.name.replace(/\.[^/.]+$/, '')}-bounding-boxes.json`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      // Show success message
      setSaveSuccess(true);
      // Hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(`Failed to save data: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Function to load bounding box data from a local JSON file
  const loadBoundingBoxData = () => {
    // Create a hidden file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';
    fileInput.style.display = 'none';
    
    // Handle file selection
    fileInput.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement;
      if (!target.files || !target.files[0]) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          if (e.target?.result) {
            // Parse the JSON file
            const loadedData = JSON.parse(e.target.result as string);
            
            // Basic validation
            if (!loadedData.data || !loadedData.pdfData || !loadedData.fileName) {
              throw new Error("Invalid bounding box data format");
            }
            
            // Convert base64 back to blob
            const byteCharacters = atob(loadedData.pdfData);
            const byteNumbers = new Array(byteCharacters.length);
            
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            
            // Create a File object from the blob
            const pdfFile = new File([blob], loadedData.fileName, { type: 'application/pdf' });
            
            // Set the file and create object URL
            setFile(pdfFile);
            const objectUrl = URL.createObjectURL(blob);
            setPdfUrl(objectUrl);
            setRawPdfData(loadedData.pdfData);
            
            // Set the parsed results directly
            setParsedResults(loadedData.data);
            
            // Notify parent component about loaded boxes if callback provided
            if (onBoxesLoaded && externalControls) {
              const allBoxes = loadedData.data.pages.flatMap((page: any) => page.boxes);
              onBoxesLoaded(allBoxes, null);
            }
            
            // Show success message
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
          }
        } catch (err) {
          setError(`Error loading bounding box data: ${err instanceof Error ? err.message : String(err)}`);
        }
      };
      
      reader.readAsText(target.files[0]);
    });
    
    // Trigger the file input click
    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
  };

  // When component mounts or updates with external controls prop change
  useEffect(() => {
    // If using external controls, make all boxes data available
    if (externalControls && parsedResults && onBoxesLoaded) {
      const allBoxes = parsedResults.pages.flatMap(page => page.boxes);
      onBoxesLoaded(allBoxes, selectedBox);
    }
  }, [externalControls, parsedResults, selectedBox, onBoxesLoaded]);

  return (
    <div className="pdf-processor">
      <div className="pdf-processor-header">
        <h2>PDF Processor</h2>
        <button onClick={onClose} className="close-button">×</button>
      </div>
      
      <div className="pdf-processor-content">
        <div className="file-upload">
          <input 
            type="file" 
            accept=".pdf" 
            onChange={handleFileChange} 
            disabled={isProcessing} 
          />
          <button 
            onClick={processFile} 
            disabled={!file || isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Extract Text & Bounding Boxes'}
          </button>
          
          {/* Add Save Bounding Box Data button */}
          {parsedResults && (
            <button 
              onClick={saveBoundingBoxData}
              className="save-button"
              title="Save bounding box data to use on form creation page"
            >
              Save Bounding Box Data
            </button>
          )}

          {/* Add Load Bounding Box Data button */}
          <button 
            onClick={loadBoundingBoxData}
            className="load-button"
            title="Load bounding box data from a JSON file"
          >
            Load Bounding Box Data
          </button>

          {/* Success message notification */}
          {saveSuccess && (
            <div className="success-message">
              Bounding box data saved successfully!
            </div>
          )}
        </div>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        <div className="pdf-viewer-container">
          {pdfUrl && (
            <div className="pdf-viewer-wrapper">
              <div className="pdf-viewer">
                {/* Only show controls if not using external controls */}
                {!externalControls && (
                  <div className="pdf-controls">
                    <button 
                      onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
                      disabled={currentPage <= 1}
                    >
                      Previous
                    </button>
                    <span>
                      Page {currentPage} of {numPages}
                    </span>
                    <button 
                      onClick={() => handlePageChange(Math.min(currentPage + 1, numPages))}
                      disabled={currentPage >= numPages}
                    >
                      Next
                    </button>
                    <select 
                      value={scale} 
                      onChange={e => setScale(parseFloat(e.target.value))}
                    >
                      <option value="0.5">50%</option>
                      <option value="0.75">75%</option>
                      <option value="1">100%</option>
                      <option value="1.25">125%</option>
                      <option value="1.5">150%</option>
                    </select>
                  </div>
                )}
                
                <div className="pdf-document-container" ref={pageRef}>
                  <Document
                    file={pdfUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    error="Failed to load PDF"
                  >
                    <Page 
                      pageNumber={currentPage}
                      scale={scale}
                      onRenderSuccess={onPageRender}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </Document>
                  <canvas 
                    ref={canvasRef} 
                    className="bounding-boxes-overlay"
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseLeave}
                  />
                </div>
              </div>
              
              {/* Only show sidebar if not using external controls */}
              {parsedResults && !externalControls && (
                <div className="box-editor-sidebar">
                  <h3>Bounding Box Editor</h3>
                  {selectedBox ? (
                    <div className="box-editor">
                      <p className="selected-text">"{selectedBox.text}"</p>
                      <div className="coordinate-inputs">
                        <label>
                          X:
                          <input 
                            type="number"
                            value={selectedBox.x}
                            onChange={(e) => handleCoordinateChange('x', e.target.value)}
                          />
                        </label>
                        <label>
                          Y:
                          <input 
                            type="number"
                            value={selectedBox.y}
                            onChange={(e) => handleCoordinateChange('y', e.target.value)}
                          />
                        </label>
                        <label>
                          Width:
                          <input 
                            type="number"
                            value={selectedBox.width}
                            onChange={(e) => handleCoordinateChange('width', e.target.value)}
                          />
                        </label>
                        <label>
                          Height:
                          <input 
                            type="number"
                            value={selectedBox.height}
                            onChange={(e) => handleCoordinateChange('height', e.target.value)}
                          />
                        </label>
                      </div>
                      <div className="editing-help">
                        <p className="help-text">
                          <strong>Tips:</strong>
                          <ul>
                            <li>Click and drag to move boxes</li>
                            <li>Edit coordinates directly in the fields above</li>
                            <li>Coordinates are normalized from 0-1000</li>
                          </ul>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="no-selection">Click on a bounding box to edit.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        {rawResults && (
          <div className="results">
            <h3>Extracted Text:</h3>
            <div className="extracted-text-container">
              {parsedResults && parsedResults.pages && parsedResults.pages.map((page, pageIdx) => (
                <div key={pageIdx} className="page-results">
                  <h4>Page {pageIdx + 1}</h4>
                  <ul>
                    {page.boxes.map((box, boxIdx) => (
                      <li 
                        key={boxIdx} 
                        className={selectedBox?.id === box.id ? 'selected-box-result' : ''}
                        onClick={() => {
                          if (box.page === currentPage) {
                            handleBoxSelection(box);
                          } else {
                            handlePageChange(box.page);
                            setTimeout(() => handleBoxSelection(box), 300);
                          }
                        }}
                      >
                        "{box.text}" (x:{box.x}, y:{box.y}, w:{box.width}, h:{box.height})
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default PdfProcessor;