import React, { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { GoogleGenAI } from '@google/genai';
import { pdfjs, Document, Page } from 'react-pdf';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import useCookie from '../hooks/useCookie';
import { processPdfWithGemini, mapVariablesToBoxes } from '../services/pdfService';
import { BoundingBox, PdfResults, VariableField, VariableMapping, FieldMappingResult } from '../types/pdfTypes';
import './PdfProcessor.css';
import VariableFieldsManager from './VariableFieldsManager';
import './VariableFieldsManager.css';
// Import the new utility functions
import { normalizeCoordinates, denormalizeCoordinates } from '../utils/pdfCoordinateUtils';

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
  // Add variable fields props
  variableFields?: VariableField[];
  onVariableFieldsChange?: (fields: VariableField[]) => void;
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
  mapFields: (fields?: VariableField[]) => Promise<VariableField[] | void>; // Update signature to accept fields and return updated fields
  updateBoxNames: (fields: VariableField[]) => void; // Add this function to the ref interface
}

const PdfProcessor = forwardRef<PdfProcessorRef, PdfProcessorProps>((props, ref) => {
  const { 
    onClose,
    onBoxesLoaded,
    onPageChange,
    onBoxSelect,
    onCoordinateChange,
    externalControls = false,
    // Access variable fields props
    variableFields: propVariableFields,
    onVariableFieldsChange
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

  // Variable fields and mapping states - use local state only if props not provided
  const [localVariableFields, setLocalVariableFields] = useState<VariableField[]>([]);
  const [variableMappings, setVariableMappings] = useState<VariableMapping[]>([]);
  const [unmappedBoxIds, setUnmappedBoxIds] = useState<string[]>([]);
  const [isMappingInProgress, setIsMappingInProgress] = useState(false);
  const [showVariables, setShowVariables] = useState(true);

  // Use props variable fields if provided, otherwise use local state
  const variableFields = propVariableFields ?? localVariableFields;
  
  // Handle variable fields change with prop callback if provided
  const handleVariableFieldsChange = useCallback((fields: VariableField[]) => {
    if (onVariableFieldsChange) {
      onVariableFieldsChange(fields);
    } else {
      setLocalVariableFields(fields);
    }
  }, [onVariableFieldsChange]);

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
      // Reset variable mappings when a new file is loaded
      setVariableMappings([]);
      setUnmappedBoxIds([]);
      
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
          // Reset variable mappings when new boxes are extracted
          setVariableMappings([]);
          setUnmappedBoxIds([]);
          
          // Auto-create variable fields based on extracted boxes
          const extractedFields = processedData.pages
            .flatMap(page => page.boxes)
            .map(box => ({
              id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: box.text.replace(/[^\w\s]/g, '').trim(),
              value: '',
              boxId: box.id
            }));
          
          // Only set auto-created fields if no fields exist yet
          if (variableFields.length === 0) {
            handleVariableFieldsChange(extractedFields);
          }
          
          // Set all boxes as unmapped initially
          setUnmappedBoxIds(processedData.pages.flatMap(page => 
            page.boxes.map(box => box.id || '')
          ).filter(id => id));
          
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

  // Map variable fields to bounding boxes using Gemini
  const handleMapFields = async (fields?: VariableField[]) => {
    if (!parsedResults || !apiKey || variableFields.length === 0) {
      setError("Missing PDF data, API key, or variable fields");
      return;
    }

    setIsMappingInProgress(true);
    setError(null);

    try {
      // Extract variable names for mapping
      const variableNames = (fields ?? variableFields).map(field => field.name);
      
      // Get all bounding boxes
      const allBoxes = parsedResults.pages.flatMap(page => page.boxes);
      
      // Call the AI service to map variables to boxes
      const result = await mapVariablesToBoxes(apiKey, variableNames, allBoxes);
      
      if (result) {
        try {
          const mappingResult = JSON.parse(result) as FieldMappingResult;
          
          // Update variable fields with mapped box IDs
          const updatedFields = (fields ?? variableFields).map(field => {
            const mapping = mappingResult.mappings.find(m => m.fieldId === field.name);
            return mapping ? { ...field, boxId: mapping.boxId } : field;
          });
          
          handleVariableFieldsChange(updatedFields);
          setVariableMappings(mappingResult.mappings);
          setUnmappedBoxIds(mappingResult.unmappedBoxes);
          
          // Create additional fields for unmapped boxes if needed
          const existingBoxIds = updatedFields
            .filter(field => field.boxId)
            .map(field => field.boxId as string);
          
          const newFieldsForUnmappedBoxes = mappingResult.unmappedBoxes
            .filter(boxId => !existingBoxIds.includes(boxId))
            .map(boxId => {
              const box = allBoxes.find(box => box.id === boxId);
              return {
                id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: box ? box.text.replace(/[^\w\s]/g, '').trim() : `Field ${boxId}`,
                value: '',
                boxId
              };
            });
          
          if (newFieldsForUnmappedBoxes.length > 0) {
            handleVariableFieldsChange([...updatedFields, ...newFieldsForUnmappedBoxes]);
          }
          
          // Switch to showing variables instead of bounding boxes
          setShowVariables(true);
          
          return updatedFields;
        } catch (parseError) {
          console.error("Error parsing mapping results:", parseError);
          setError("Failed to parse mapping results as JSON.");
        }
      }
    } catch (err) {
      console.error("Error mapping variables:", err);
      setError(`Error mapping variables: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsMappingInProgress(false);
    }
  };

  // Toggle between showing variables or bounding boxes
  const toggleVariableView = () => {
    setShowVariables(!showVariables);
  };

  // Modified renderBoundingBoxes to handle variable fields
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
    
    if (showVariables && variableMappings.length > 0) {
      // Draw variable fields instead of bounding boxes
      currentPageBoxes.forEach(box => {
        // Check if this box has a variable mapping
        const field = variableFields.find(field => field.boxId === box.id);
        
        // Normalize coordinates for this box using the imported function
        const { x, y, width: boxWidth, height: boxHeight } = normalizeCoordinates(box, width, height, scale); // Use imported function
        
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
      // Draw regular bounding boxes (original implementation)
      currentPageBoxes.forEach(box => {
        // Normalize coordinates using the imported function
        const { x, y, width: boxWidth, height: boxHeight } = normalizeCoordinates(box, width, height, scale); // Use imported function
        
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
  }, [parsedResults, currentPage, scale, selectedBox, variableFields, variableMappings, unmappedBoxIds, showVariables]); // Add scale to dependency array

  // Effect for rendering bounding boxes
  useEffect(() => {
    if (parsedResults && canvasRef.current) {
      const pageElement = pageRef.current?.querySelector('.react-pdf__Page');
      if (pageElement) {
        renderBoundingBoxes(pageElement);
      }
    }
  }, [parsedResults, currentPage, scale, selectedBox, renderBoundingBoxes]);
  
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
        
        // Reset variable mappings when loading a saved PDF
        setVariableMappings([]);
        handleVariableFieldsChange([]);
        setUnmappedBoxIds(props.loadedPdfData.data.pages.flatMap((page: any) => 
          page.boxes.map((box: any) => box.id || '')
        ).filter((id: string) => id));
        
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

  // Page render callback
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
      // Use imported normalizeCoordinates
      const { x, y, width: boxWidth, height: boxHeight } = normalizeCoordinates(box, width, height, scale); 
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
  };

  const handleCanvasMouseLeave = () => {
    setIsDragging(false);
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
    getSelectedBox: () => selectedBox,
    mapFields: handleMapFields, // Expose mapFields function
    updateBoxNames: handleVariableFieldsChange // Expose updateBoxNames function
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
      pdfData: rawPdfData,
      // Also save variable fields and mappings if they exist
      variableFields: variableFields.length > 0 ? variableFields : undefined,
      variableMappings: variableMappings.length > 0 ? variableMappings : undefined,
      unmappedBoxIds: unmappedBoxIds.length > 0 ? unmappedBoxIds : undefined
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
            
            // Load variable fields and mappings if they exist
            if (loadedData.variableFields) {
              handleVariableFieldsChange(loadedData.variableFields);
            }
            
            if (loadedData.variableMappings) {
              setVariableMappings(loadedData.variableMappings);
            }
            
            if (loadedData.unmappedBoxIds) {
              setUnmappedBoxIds(loadedData.unmappedBoxIds);
            } else {
              // Set all boxes as unmapped
              const allBoxIds = loadedData.data.pages.flatMap((page: any) => 
                page.boxes.map((box: any) => box.id || '')
              ).filter((id: string) => id);
              setUnmappedBoxIds(allBoxIds);
            }
            
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

  // Define an interface for the items in filledFields
  interface FilledFieldItem {
    field: VariableField;
    box: BoundingBox; // Mark box as non-optional since we filter undefined ones
  }

  // Define an interface for the structure being built in the reduce function
  interface FieldsByPageJSONAccumulator {
    [key: string]: {
      field: {
        id: string;
        name: string;
        value: string | undefined;
        boxId: string | undefined;
      };
      box: {
        id: string | undefined;
        x: number;
        y: number;
        width: number;
        height: number;
        page: number;
        text: string;
      };
    }[];
  }

  // Function to print filled PDF with variable values
  const printPdf = async () => {
    if (!file || !pdfUrl || !variableFields || variableFields.length === 0 || !parsedResults) {
      setError("Missing file or variable fields to print PDF");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Create a new window with the existing PDF URL
      const printWindow = window.open('', '_blank');
      
      if (!printWindow) {
        setError("Print window was blocked. Please allow popups and try again.");
        setIsProcessing(false);
        return;
      }

      // Get filled fields with their associated boxes
      const filledFields = variableFields
        .filter(field => field.value && field.boxId)
        .map(field => {
          const box = parsedResults.pages
            .flatMap(page => page.boxes)
            .find(box => box.id === field.boxId);
          
          // Return null if box is not found, filter later
          return box ? { field, box } : null;
        })
        .filter((item): item is FilledFieldItem => item !== null && item.box !== undefined); // Ensure item and item.box are defined and type guard

      // Group fields by page
      const fieldsByPage: Record<number, FilledFieldItem[]> = {}; // Explicitly type fieldsByPage
      filledFields.forEach(item => {
        // No need for null check here due to the filter above, TS should infer correctly now
        const pageNum = item.box.page;
        if (!fieldsByPage[pageNum]) {
          fieldsByPage[pageNum] = [];
        }
        fieldsByPage[pageNum].push(item);
      });
      
      // Stringify fieldsByPage in a safer way for HTML insertion
      const fieldsByPageJSON = JSON.stringify(
        Object.entries(fieldsByPage).reduce((acc: FieldsByPageJSONAccumulator, [pageNum, items]: [string, FilledFieldItem[]]) => { // Type the accumulator and items
          acc[pageNum] = items.map(item => ({ // item type is now inferred correctly
            field: {
              id: item.field.id,
              name: item.field.name,
              value: item.field.value,
              boxId: item.field.boxId
            },
            box: {
              id: item.box.id,
              x: item.box.x, 
              y: item.box.y,
              width: item.box.width,
              height: item.box.height,
              page: item.box.page,
              text: item.box.text
            }
          }));
          return acc;
        }, {} as FieldsByPageJSONAccumulator) // Initial value for reduce with type assertion
      );

      // Write HTML content to the new window
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Print PDF - ${file.name}</title>
          <style>
            body, html {
              margin: 0;
              padding: 0;
              height: 100%;
              overflow: auto;
            }
            #pdf-container {
              position: relative;
              margin: 0 auto;
            }
            .page-container {
              position: relative;
              margin-bottom: 20px;
              page-break-after: always;
              box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
            }
            .page-container:last-child {
              page-break-after: auto;
            }
            .form-field {
              position: absolute;
              background-color: white;
              color: black;
              border: none;
              font-family: Arial, sans-serif;
              padding: 0px 2px;
              margin: 0;
              overflow: hidden;
              display: flex;
              align-items: center;
              text-align: left;
              line-height: 1.2;
            }
            @media print {
              body {
                background-color: white;
              }
              .controls {
                display: none;
              }
              .page-container {
                margin: 0;
                page-break-after: always;
                box-shadow: none;
              }
            }
            .controls {
              position: fixed;
              top: 10px;
              right: 10px;
              padding: 10px;
              background-color: white;
              border: 1px solid #ccc;
              border-radius: 5px;
              box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
              z-index: 1000;
            }
            .print-button {
              background-color: #4caf50;
              color: white;
              border: none;
              padding: 8px 16px;
              font-size: 16px;
              cursor: pointer;
              border-radius: 4px;
            }
          </style>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js"></script>
        </head>
        <body>
          <div class="controls">
            <button class="print-button" onclick="window.print(); setTimeout(() => window.close(), 500);">
              Print
            </button>
          </div>
          <div id="pdf-container"></div>
          
          <script>
            // Set up PDF.js worker
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

            // Fields by page from the React app
            const fieldsByPage = ${fieldsByPageJSON};
            
            async function renderPdf() {
              try {
                // Load the PDF document
                const loadingTask = pdfjsLib.getDocument('${pdfUrl}');
                const pdf = await loadingTask.promise;
                
                const container = document.getElementById('pdf-container');
                const totalPages = pdf.numPages;
                
                // Render each page of the PDF
                for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                  const page = await pdf.getPage(pageNum);
                  const viewport = page.getViewport({ scale: 1.5 }); // Adjust scale for better print quality
                  
                  // Create page container
                  const pageContainer = document.createElement('div');
                  pageContainer.className = 'page-container';
                  pageContainer.style.width = viewport.width + 'px';
                  pageContainer.style.height = viewport.height + 'px';
                  container.appendChild(pageContainer);
                  
                  // Create canvas for the PDF page
                  const canvas = document.createElement('canvas');
                  canvas.width = viewport.width;
                  canvas.height = viewport.height;
                  pageContainer.appendChild(canvas);
                  
                  // Render PDF page to canvas
                  const renderContext = {
                    canvasContext: canvas.getContext('2d'),
                    viewport: viewport
                  };
                  
                  await page.render(renderContext).promise;
                  
                  // Add form fields for this page if any exist
                  if (fieldsByPage[pageNum]) {
                    fieldsByPage[pageNum].forEach(item => {
                      const { field, box } = item;
                      
                      // Create field element
                      const fieldElement = document.createElement('div');
                      fieldElement.className = 'form-field';
                      
                      // Convert normalized coordinates (0-1000) to actual page coordinates
                      const x = (box.x / 1000) * viewport.width;
                      const y = (box.y / 1000) * viewport.height;
                      const width = (box.width / 1000) * viewport.width;
                      const height = (box.height / 1000) * viewport.height;
                      
                      // Position and size the field
                      fieldElement.style.left = x + 'px';
                      fieldElement.style.top = y + 'px';
                      fieldElement.style.width = width + 'px';
                      fieldElement.style.height = height + 'px';
                      
                      // Set text size based on height (similar to the way it's shown in preview)
                      fieldElement.style.fontSize = Math.min(height * 0.7, 14) + 'px';
                      
                      // Set the field value
                      fieldElement.textContent = field.value;
                      
                      // Add the field to the page
                      pageContainer.appendChild(fieldElement);
                    });
                  }
                }
                
                // Show success message
                console.log('PDF prepared for printing');
              } catch (error) {
                console.error('Error rendering PDF:', error);
                document.body.innerHTML += '<p>Error rendering PDF: ' + error.message + '</p>';
              }
            }
            
            // Start rendering when the page has loaded
            window.onload = renderPdf;
          </script>
        </body>
        </html>
      `);
      
      printWindow.document.close();
      
      // Show success message
      setSaveSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Error printing PDF:", err);
      setError(`Failed to print PDF: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
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
        <div className="main-viewer-area">
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

            {/* Add Save Filled PDF button */}
            {variableFields.length > 0 && (
              <button 
                onClick={printPdf}
                className="save-filled-pdf-button"
                title="Print filled PDF with variable values"
              >
                Print PDF
              </button>
            )}

            {/* Toggle view button */}
            {parsedResults && variableMappings.length > 0 && (
              <button 
                onClick={toggleVariableView}
                className="toggle-view-button"
                title="Toggle between variables and bounding boxes"
              >
                {showVariables ? 'Show Bounding Boxes' : 'Show Variables'}
              </button>
            )}

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
              </div>
            )}
            
            {!pdfUrl && (
              <div className="no-pdf-placeholder">
                <p>Upload a PDF to begin processing</p>
              </div>
            )}
          </div>
        </div>
        
        {rawResults && (
          <div className="results">
            <h3>Extracted Text:</h3>
            <div className="extracted-text-container">
              {parsedResults && parsedResults.pages && parsedResults.pages.map((page, pageIdx) => (
                <div key={pageIdx} className="page-results">
                  <h4>Page {pageIdx + 1}</h4>
                  <ul>
                    {page.boxes.map((box, boxIdx) => {
                      // Find if this box has a mapped variable
                      const mappedField = variableFields.find(field => field.boxId === box.id);
                      
                      return (
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
                          "{box.text}" 
                          {mappedField && (
                            <span className="mapped-field">
                              → {mappedField.name}: {mappedField.value || '[empty]'}
                            </span>
                          )}
                          <span className="box-coordinates">
                            (x:{box.x}, y:{box.y}, w:{box.width}, h:{box.height})
                          </span>
                        </li>
                      );
                    })}
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