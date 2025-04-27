import React, { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Document, Page } from 'react-pdf';
import { pdfjs } from 'react-pdf';
import useCookie from '../hooks/useCookie';
import { 
  mapVariablesToBoxes, 
  processFileWithGemini,
  printFilledPdf
} from '../services/pdfService';
import { 
  handlePdfFileChange, 
  saveBoundingBoxData as saveBoundingBoxDataService,
  loadBoundingBoxData as loadBoundingBoxDataService,
  createPdfFileFromBase64
} from '../services/pdfFileService';
import { BoundingBox, PdfResults, VariableField, VariableMapping, FieldMappingResult } from '../types/pdfTypes';
import './PdfProcessor.css';
// Remove unused import
import './VariableFieldsManager.css';
// Import only the used utility function
import { normalizeCoordinates } from '../utils/pdfCoordinateUtils';

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
  printPdf: () => Promise<void>; // Add the printPdf function to the ref interface
  isProcessing: boolean;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  processFile: () => Promise<void>;
  saveBoundingBoxData: () => Promise<void>;
  loadBoundingBoxData: () => Promise<void>;
  toggleVariableView: () => void;
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
  // Remove unused cookie state variables
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
  // Keep this variable but mark it as intended to be unused with underscore prefix
  const [_isMappingInProgress, setIsMappingInProgress] = useState(false);
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

  // Handle file change with the service function
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      setFile(selectedFile);
      setError(null);
      setRawResults(null);
      setParsedResults(null);
      setSelectedBox(null);
      // Reset variable mappings when a new file is loaded
      setVariableMappings([]);
      setUnmappedBoxIds([]);
      
      // Use the service function instead of implementing the file reading here
      try {
        const result = await handlePdfFileChange(selectedFile);
        
        if (result.error) {
          setError(result.error);
          return;
        }
        
        setPdfUrl(result.objectUrl);
        setRawPdfData(result.rawPdfData);
      } catch (err) {
        console.error("Error handling PDF file:", err);
        setError(`Error handling PDF file: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };

  // Process file updated to use the new service function
  const processFile = async () => {
    if (!file || !apiKey) {
      setError("Missing file or API key");
      return;
    }

    setIsProcessing(true);
    setError(null);
    
    try {
      // Use the service function instead of implementing file processing here
      const result = await processFileWithGemini(file, apiKey);

      setRawResults(result.rawResults || "No results returned");
      setParsedResults(result.parsedResults);
      
      if (result.error) {
        setError(result.error);
      }
      
      if (result.parsedResults) {
        // Reset variable mappings when new boxes are extracted
        setVariableMappings([]);
        setUnmappedBoxIds([]);
        
        // Auto-create variable fields based on extracted boxes
        const extractedFields = result.parsedResults.pages
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
        setUnmappedBoxIds(result.parsedResults.pages.flatMap(page => 
          page.boxes.map(box => box.id || '')
        ).filter(id => id));
        
        // Notify parent component about loaded boxes if callback provided
        if (onBoxesLoaded && externalControls) {
          const allBoxes = result.parsedResults.pages.flatMap(page => page.boxes);
          onBoxesLoaded(allBoxes, null);
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
        // Use the service function to create a File from base64
        const { file: pdfFile, objectUrl, error } = createPdfFileFromBase64(
          props.loadedPdfData.pdfData,
          props.loadedPdfData.fileName
        );
        
        if (error || !pdfFile) {
          setError(error || "Failed to create PDF file");
          return;
        }
        
        // Set the file and object URL
        setFile(pdfFile);
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
    updateBoxNames: handleVariableFieldsChange, // Expose updateBoxNames function
    printPdf, // Expose printPdf function
    isProcessing,
    handleFileChange,
    processFile,
    saveBoundingBoxData,
    loadBoundingBoxData,
    toggleVariableView
  }));

  // Function to save bounding box data to a local JSON file
  const saveBoundingBoxData = async () => {
    if (!parsedResults || !rawPdfData || !file) {
      setError("Missing PDF data or bounding boxes to save");
      return;
    }

    try {
      // Use the service function instead of implementing the save logic here
      const result = saveBoundingBoxDataService(
        parsedResults, 
        rawPdfData, 
        file, 
        variableFields, 
        variableMappings, 
        unmappedBoxIds
      );
      
      if (result.success) {
        // Show success message
        setSaveSuccess(true);
        // Hide success message after 3 seconds
        setTimeout(() => setSaveSuccess(false), 3000);
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(`Failed to save data: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Function to load bounding box data from a local JSON file
  const loadBoundingBoxData = async () => {
    try {
      // Use the service function instead of implementing the load logic here
      const loadedData = await loadBoundingBoxDataService();
      
      // Set the file and create object URL
      setFile(loadedData.file);
      setPdfUrl(loadedData.objectUrl);
      setRawPdfData(loadedData.rawPdfData);
      
      // Set the parsed results directly
      setParsedResults(loadedData.parsedResults);
      
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
        const allBoxIds = loadedData.parsedResults.pages.flatMap(page => 
          page.boxes.map(box => box.id || '')
        ).filter(id => id);
        setUnmappedBoxIds(allBoxIds);
      }
      
      // Notify parent component about loaded boxes if callback provided
      if (onBoxesLoaded && externalControls) {
        const allBoxes = loadedData.parsedResults.pages.flatMap(page => page.boxes);
        onBoxesLoaded(allBoxes, null);
      }
      
      // Show success message
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError(`Error loading bounding box data: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Define an interface for the items in filledFields
  type _FilledFieldItem = {
    field: VariableField;
    box: BoundingBox; // Mark box as non-optional since we filter undefined ones
  }

  // Define an interface for the structure being built in the reduce function
  type _FieldsByPageJSONAccumulator = {
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

  // Function to print filled PDF with variable values - updated to use service function
  const printPdf = async () => {
    if (!file || !pdfUrl || !variableFields || variableFields.length === 0 || !parsedResults) {
      setError("Missing file or variable fields to print PDF");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Use the service function instead of implementing PDF printing logic here
      const result = await printFilledPdf(
        file,
        pdfUrl,
        variableFields,
        parsedResults
      );
      
      if (result.error) {
        setError(result.error);
        return;
      }
      
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
  }, [externalControls, parsedResults, selectedBox, onBoxesLoaded, handleVariableFieldsChange]);

  return (
    <div className="pdf-processor">
      <div className="pdf-processor-header">
        <h2>PDF Processor</h2>
        <button onClick={onClose} className="close-button">×</button>
      </div>
      
      <div className="pdf-processor-content">
        <div className="main-viewer-area">
          {/* File input only shown if not using external controls */}
          {!externalControls && (
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
              
              {parsedResults && (
                <button 
                  onClick={saveBoundingBoxData}
                  className="save-button"
                  title="Save bounding box data to use on form creation page"
                >
                  Save Bounding Box Data
                </button>
              )}

              <button 
                onClick={loadBoundingBoxData}
                className="load-button"
                title="Load bounding box data from a JSON file"
              >
                Load Bounding Box Data
              </button>

              {variableFields.length > 0 && (
                <button 
                  onClick={printPdf}
                  className="save-filled-pdf-button"
                  title="Print filled PDF with variable values"
                >
                  Print PDF
                </button>
              )}

              {parsedResults && variableMappings.length > 0 && (
                <button 
                  onClick={toggleVariableView}
                  className="toggle-view-button"
                  title="Toggle between variables and bounding boxes"
                >
                  {showVariables ? 'Show Bounding Boxes' : 'Show Variables'}
                </button>
              )}
            </div>
          )}

          {/* Success message notification */}
          {saveSuccess && (
            <div className="success-message">
              Operation completed successfully!
            </div>
          )}
          
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