import React, { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
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
import './VariableFieldsManager.css';
import { normalizeCoordinates } from '../utils/pdfCoordinateUtils';
import { fileToBase64, base64ToBlob } from '../utils/pdfUtils';
import PdfViewer from './PdfViewer';

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
  variableFields?: VariableField[];
  onVariableFieldsChange?: (fields: VariableField[]) => void;
  scale?: number;
  onScaleChange?: (scale: number) => void;
  currentPage?: number;
  selectedBox?: BoundingBox | null;
}

export interface PdfProcessorRef {
  selectBoxById: (boxId: string | null) => void;
  handlePageChange: (newPage: number) => void;
  handleCoordinateChange: (field: 'x' | 'y' | 'width' | 'height', value: string) => void;
  getCurrentPage: () => number;
  getTotalPages: () => number;
  getAllBoxes: () => BoundingBox[];
  getSelectedBox: () => BoundingBox | null;
  mapFields: (fields?: VariableField[]) => Promise<VariableField[] | void>;
  updateBoxNames: (fields: VariableField[]) => void;
  printPdf: () => Promise<void>;
  isProcessing: boolean;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  processFile: () => Promise<void>;
  saveBoundingBoxData: () => Promise<void>;
  loadBoundingBoxData: () => Promise<void>;
  toggleVariableView: () => void;
  saveCurrentState: () => void;
  restoreState: () => void;
}

const PdfProcessor = forwardRef<PdfProcessorRef, PdfProcessorProps>((props, ref) => {
  const { 
    onClose,
    onBoxesLoaded,
    onPageChange,
    onBoxSelect,
    onCoordinateChange,
    externalControls = false,
    variableFields: propVariableFields,
    onVariableFieldsChange,
    scale: propScale,
    onScaleChange: propOnScaleChange,
    currentPage: propCurrentPage,
    selectedBox: propSelectedBox
  } = props;
  
  const [apiKey] = useCookie('geminiApiKey');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rawPdfData, setRawPdfData] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rawResults, setRawResults] = useState<string | null>(null);
  const [parsedResults, setParsedResults] = useState<PdfResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  
  const [internalCurrentPage, setInternalCurrentPage] = useState<number>(1);
  const [internalScale, setInternalScale] = useState<number>(1.0);
  const [internalSelectedBox, setInternalSelectedBox] = useState<BoundingBox | null>(null);
  const [localVariableFields, setLocalVariableFields] = useState<VariableField[]>([]);
  
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);

  const [variableMappings, setVariableMappings] = useState<VariableMapping[]>([]);
  const [unmappedBoxIds, setUnmappedBoxIds] = useState<string[]>([]);
  const [_isMappingInProgress, setIsMappingInProgress] = useState(false);
  const [showVariables, setShowVariables] = useState(true);

  const currentPage = externalControls ? (propCurrentPage ?? 1) : internalCurrentPage;
  const scale = externalControls ? (propScale ?? 1.0) : internalScale;
  const selectedBox = externalControls ? (propSelectedBox ?? null) : internalSelectedBox;
  const variableFields = propVariableFields ?? localVariableFields;

  const setCurrentPageHandler = useCallback((newPage: number) => {
    if (externalControls) {
      onPageChange?.(newPage, numPages);
    } else {
      setInternalCurrentPage(newPage);
    }
  }, [externalControls, onPageChange, numPages]);

  const setScaleHandler = useCallback((newScale: number) => {
    if (externalControls) {
      propOnScaleChange?.(newScale);
    } else {
      setInternalScale(newScale);
    }
  }, [externalControls, propOnScaleChange]);

  const setSelectedBoxHandler = useCallback((box: BoundingBox | null) => {
    if (externalControls) {
      onBoxSelect?.(box);
    } else {
      setInternalSelectedBox(box);
    }
  }, [externalControls, onBoxSelect]);

  const setVariableFieldsHandler = useCallback((fields: VariableField[]) => {
    if (externalControls && onVariableFieldsChange) {
      onVariableFieldsChange(fields);
    } else {
      setLocalVariableFields(fields);
    }
  }, [externalControls, onVariableFieldsChange]);

  const handleVariableFieldsChange = setVariableFieldsHandler;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      setFile(selectedFile);
      setError(null);
      setRawResults(null);
      setParsedResults(null);
      setSelectedBoxHandler(null);
      setVariableMappings([]);
      setUnmappedBoxIds([]);
      
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

  const processFile = async () => {
    if (!file || !apiKey) {
      setError("Missing file or API key");
      return;
    }

    setIsProcessing(true);
    setError(null);
    
    try {
      const result = await processFileWithGemini(file, apiKey);

      setRawResults(result.rawResults || "No results returned");
      setParsedResults(result.parsedResults);
      
      if (result.error) {
        setError(result.error);
      }
      
      if (result.parsedResults) {
        setVariableMappings([]);
        setUnmappedBoxIds([]);
        
        const extractedFields = result.parsedResults.pages
          .flatMap(page => page.boxes)
          .map(box => ({
            id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: box.text.replace(/[^\w\s]/g, '').trim(),
            value: '',
            boxId: box.id
          }));
        
        if (variableFields.length === 0) {
          handleVariableFieldsChange(extractedFields);
        }
        
        setUnmappedBoxIds(result.parsedResults.pages.flatMap(page => 
          page.boxes.map(box => box.id || '')
        ).filter(id => id));
        
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

  const handleMapFields = async (fields?: VariableField[]) => {
    if (!parsedResults || !apiKey || variableFields.length === 0) {
      setError("Missing PDF data, API key, or variable fields");
      return;
    }

    setIsMappingInProgress(true);
    setError(null);

    try {
      const variableNames = (fields ?? variableFields).map(field => field.name);
      const allBoxes = parsedResults.pages.flatMap(page => page.boxes);
      const result = await mapVariablesToBoxes(apiKey, variableNames, allBoxes);
      
      if (result) {
        try {
          const mappingResult = JSON.parse(result) as FieldMappingResult;
          
          const updatedFields = (fields ?? variableFields).map(field => {
            const mapping = mappingResult.mappings.find(m => m.fieldId === field.name);
            return mapping ? { ...field, boxId: mapping.boxId } : field;
          });
          
          handleVariableFieldsChange(updatedFields);
          setVariableMappings(mappingResult.mappings);
          setUnmappedBoxIds(mappingResult.unmappedBoxes);
          
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

  const toggleVariableView = () => {
    setShowVariables(!showVariables);
  };

  const renderBoundingBoxes = useCallback((pageElement: Element) => {
    if (!parsedResults || !canvasRef.current || !currentPage) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = pageElement.getBoundingClientRect();
    
    canvas.width = width;
    canvas.height = height;
    
    ctx.clearRect(0, 0, width, height);
    
    const currentPageBoxes = parsedResults.pages
      .flatMap(page => page.boxes)
      .filter(box => box.page === currentPage);
    
    if (currentPageBoxes.length === 0) return;
    
    if (showVariables && variableMappings.length > 0) {
      currentPageBoxes.forEach(box => {
        const field = variableFields.find(field => field.boxId === box.id);
        const { x, y, width: boxWidth, height: boxHeight } = normalizeCoordinates(box, width, height, scale);
        
        if (field) {
          ctx.strokeStyle = 'rgba(0, 150, 0, 0.8)';
          ctx.lineWidth = 2;
          ctx.fillStyle = 'rgba(0, 150, 0, 0.2)';
          
          ctx.strokeRect(x, y, boxWidth, boxHeight);
          ctx.fillRect(x, y, boxWidth, boxHeight);
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.font = `${Math.max(12, boxHeight * 0.6)}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const text = field.value || `[${field.name}]`;
          ctx.fillText(text, x + boxWidth / 2, y + boxHeight / 2, boxWidth * 0.9);
        } else if (unmappedBoxIds.includes(box.id || '')) {
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
      currentPageBoxes.forEach(box => {
        const { x, y, width: boxWidth, height: boxHeight } = normalizeCoordinates(box, width, height, scale);
        
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
      });
    }
  }, [parsedResults, currentPage, scale, selectedBox, variableFields, variableMappings, unmappedBoxIds, showVariables]);

  useEffect(() => {
    if (parsedResults && canvasRef.current) {
      const pageElement = pageRef.current?.querySelector('.react-pdf__Page');
      if (pageElement) {
        renderBoundingBoxes(pageElement);
      }
    }
  }, [parsedResults, currentPage, scale, selectedBox, renderBoundingBoxes]);
  
  useEffect(() => {
    console.log('PdfProcessor: checking for loadedPdfData', !!props.loadedPdfData);
    if (props.loadedPdfData && props.loadedPdfData.pdfData) {
      try {
        console.log('PdfProcessor: attempting to load PDF from loadedPdfData');
        const { file: pdfFile, objectUrl, error } = createPdfFileFromBase64(
          props.loadedPdfData.pdfData,
          props.loadedPdfData.fileName
        );
        
        if (error || !pdfFile) {
          console.error('PdfProcessor: Failed to create PDF file:', error);
          setError(error || "Failed to create PDF file");
          return;
        }
        
        console.log('PdfProcessor: Successfully created PDF file, setting state');
        setFile(pdfFile);
        setPdfUrl(objectUrl);
        setRawPdfData(props.loadedPdfData.pdfData);
        setParsedResults(props.loadedPdfData.data);
        setVariableMappings([]);
        handleVariableFieldsChange([]);
        setUnmappedBoxIds(props.loadedPdfData.data.pages.flatMap((page: any) => 
          page.boxes.map((box: any) => box.id || '')
        ).filter((id: string) => id));
        
        if (onBoxesLoaded && externalControls) {
          const allBoxes = props.loadedPdfData.data.pages.flatMap((page: any) => page.boxes);
          onBoxesLoaded(allBoxes, null);
        }
      } catch (err) {
        console.error(`PdfProcessor: Error loading saved PDF:`, err);
        setError(`Error loading saved PDF: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      console.log('PdfProcessor: No loadedPdfData available');
    }
  }, [props.loadedPdfData, onBoxesLoaded, externalControls]);
  
  // Add effect to automatically show PDF when data is available
  useEffect(() => {
    if (pdfUrl) {
      setShowPdfViewer(true);
    }
  }, [pdfUrl, currentPage, scale, parsedResults, variableFields]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setCurrentPageHandler(1);
    
    if (onPageChange && externalControls) {
      onPageChange(1, numPages);
    }
  };

  const onPageRender = useCallback(() => {
    if (parsedResults && pageRef.current) {
      const pageElement = pageRef.current.querySelector('.react-pdf__Page');
      if (pageElement) {
        setTimeout(() => renderBoundingBoxes(pageElement), 100);
      }
    }
  }, [parsedResults, renderBoundingBoxes]);

  const handlePageChange = (newPage: number) => {
    setCurrentPageHandler(newPage);
  };

  const handleBoxSelection = (box: BoundingBox | null) => {
    setSelectedBoxHandler(box);
  };

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
      setSelectedBoxHandler(foundBox);
      setIsDragging(true);
      setDragStart({ x: mouseX, y: mouseY });
    } else {
      setSelectedBoxHandler(null);
    }
  };

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
      setSelectedBoxHandler(updatedBox);
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  const handleCanvasMouseLeave = () => {
    setIsDragging(false);
  };

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
      setSelectedBoxHandler(updatedBox);
      
      if (onCoordinateChange && externalControls) {
        onCoordinateChange(field, value, updatedBox);
      }
    }
  };

  const selectBoxById = useCallback((boxId: string | null) => {
    if (!boxId || !parsedResults) {
      setSelectedBoxHandler(null);
      return;
    }
    
    const boxToSelect = parsedResults.pages
      .flatMap(page => page.boxes)
      .find(box => box.id === boxId);
    
    if (boxToSelect) {
      if (boxToSelect.page !== currentPage) {
        setCurrentPageHandler(boxToSelect.page);
        setTimeout(() => setSelectedBoxHandler(boxToSelect), 100);
      } else {
        setSelectedBoxHandler(boxToSelect);
      }
    } else {
      setSelectedBoxHandler(null);
    }
  }, [parsedResults, currentPage, setCurrentPageHandler, setSelectedBoxHandler]);

  useImperativeHandle(ref, () => ({
    selectBoxById,
    handlePageChange,
    handleCoordinateChange,
    getCurrentPage: () => currentPage,
    getTotalPages: () => numPages,
    getAllBoxes: () => parsedResults ? parsedResults.pages.flatMap(page => page.boxes) : [],
    getSelectedBox: () => selectedBox,
    mapFields: handleMapFields,
    updateBoxNames: handleVariableFieldsChange,
    printPdf,
    isProcessing,
    handleFileChange,
    processFile,
    saveBoundingBoxData,
    loadBoundingBoxData,
    toggleVariableView,
    saveCurrentState,
    restoreState
  }));

  const saveBoundingBoxData = async () => {
    if (!parsedResults || !rawPdfData || !file) {
      setError("Missing PDF data or bounding boxes to save");
      return;
    }

    try {
      const result = saveBoundingBoxDataService(
        parsedResults, 
        rawPdfData, 
        file, 
        variableFields, 
        variableMappings, 
        unmappedBoxIds
      );
      
      if (result.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(`Failed to save data: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const loadBoundingBoxData = async () => {
    try {
      const loadedData = await loadBoundingBoxDataService();
      
      setFile(loadedData.file);
      setPdfUrl(loadedData.objectUrl);
      setRawPdfData(loadedData.rawPdfData);
      setParsedResults(loadedData.parsedResults);
      
      if (loadedData.variableFields) {
        handleVariableFieldsChange(loadedData.variableFields);
      }
      
      if (loadedData.variableMappings) {
        setVariableMappings(loadedData.variableMappings);
      }
      
      if (loadedData.unmappedBoxIds) {
        setUnmappedBoxIds(loadedData.unmappedBoxIds);
      } else {
        const allBoxIds = loadedData.parsedResults.pages.flatMap(page => 
          page.boxes.map(box => box.id || '')
        ).filter(id => id);
        setUnmappedBoxIds(allBoxIds);
      }
      
      if (onBoxesLoaded && externalControls) {
        const allBoxes = loadedData.parsedResults.pages.flatMap(page => page.boxes);
        onBoxesLoaded(allBoxes, null);
      }
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError(`Error loading bounding box data: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  type _FilledFieldItem = {
    field: VariableField;
    box: BoundingBox;
  }

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

  interface PdfProcessorSavedState {
    fileName: string | null;
    fileType: string | null;
    fileData: string | null;
    pdfUrl: string | null;
    rawPdfData: string | null;
    parsedResults: PdfResults | null;
    currentPage: number;
    scale: number;
    selectedBoxId: string | null;
    variableFields: VariableField[];
    variableMappings: VariableMapping[];
    unmappedBoxIds: string[];
    showVariables: boolean;
    numPages: number;
  }

  const saveCurrentState = async () => {
    if (!file && !parsedResults) return;
    
    try {
      const savedState: PdfProcessorSavedState = {
        fileName: file ? file.name : null,
        fileType: file ? file.type : null,
        fileData: file ? await fileToBase64(file) : null,
        pdfUrl,
        rawPdfData,
        parsedResults,
        currentPage: currentPage,
        scale: scale,
        selectedBoxId: selectedBox?.id || null,
        variableFields: variableFields,
        variableMappings,
        unmappedBoxIds,
        showVariables,
        numPages: numPages
      };
      
      localStorage.setItem('pdf-processor-state', JSON.stringify(savedState));
      console.log('Saved PDF processor state');
    } catch (err) {
      console.error("Failed to save PDF processor state:", err);
    }
  };

  const restoreState = useCallback(() => {
    try {
      const savedStateString = localStorage.getItem('pdf-processor-state');
      if (!savedStateString) return;
      
      const savedState: PdfProcessorSavedState = JSON.parse(savedStateString);
      console.log('Restoring PDF processor state');
      
      // Handle file and PDF URL restoration more efficiently
      if (savedState.fileData && savedState.fileName && savedState.fileType) {
        // Create a data URL directly from the base64 data
        const dataUrl = `data:${savedState.fileType};base64,${savedState.fileData}`;
        setPdfUrl(dataUrl);
        
        // Store the raw base64 data instead of converting to File object
        setRawPdfData(savedState.fileData);
        
        // Create a lightweight File object reference that points to the same data
        // This maintains compatibility with functions expecting a File object
        const fileSize = Math.ceil(savedState.fileData.length * 0.75); // Approximate size from base64
        const fileOptions = { 
          type: savedState.fileType,
          lastModified: new Date().getTime()
        };
        
        // Create a minimal File object that references our data without conversion
        const fileReference = new File([""], savedState.fileName, fileOptions);
        Object.defineProperty(fileReference, 'size', { value: fileSize });
        
        // Set the file reference to maintain API compatibility
        setFile(fileReference);
      }
      
      if (savedState.rawPdfData) setRawPdfData(savedState.rawPdfData);
      if (savedState.parsedResults) setParsedResults(savedState.parsedResults);
      if (savedState.numPages) setNumPages(savedState.numPages);
      if (savedState.variableFields) {
        setVariableFieldsHandler(savedState.variableFields);
      }
      
      if (savedState.variableMappings) setVariableMappings(savedState.variableMappings);
      if (savedState.unmappedBoxIds) setUnmappedBoxIds(savedState.unmappedBoxIds);
      if (savedState.showVariables !== undefined) setShowVariables(savedState.showVariables);
      
      if (savedState.currentPage) {
        setCurrentPageHandler(savedState.currentPage);
      }
      
      if (savedState.scale) {
        setScaleHandler(savedState.scale);
      }
      
      setTimeout(() => {
        if (savedState.selectedBoxId) {
          selectBoxById(savedState.selectedBoxId);
        } else {
          selectBoxById(null);
        }
      }, 100);
      
      if (onBoxesLoaded && externalControls && savedState.parsedResults) {
        const allBoxes = savedState.parsedResults.pages.flatMap(page => page.boxes);
        const restoredSelectedBox = savedState.selectedBoxId 
          ? allBoxes.find(box => box.id === savedState.selectedBoxId) || null
          : null;
        
        setTimeout(() => {
          onBoxesLoaded(allBoxes, restoredSelectedBox);
        }, 100);
      }
      
      return savedState;
    } catch (err) {
      console.error("Failed to restore PDF processor state:", err);
      return null;
    }
  }, [externalControls, onBoxesLoaded, setCurrentPageHandler, setScaleHandler, setVariableFieldsHandler, selectBoxById]);

  useEffect(() => {
    if (!file && !props.loadedPdfData) {
      restoreState();
    }
  }, [restoreState, file, props.loadedPdfData]);

  useEffect(() => {
    if (externalControls && parsedResults && onBoxesLoaded) {
      const allBoxes = parsedResults.pages.flatMap(page => page.boxes);
      onBoxesLoaded(allBoxes, selectedBox);
    }
  }, [externalControls, parsedResults, selectedBox, onBoxesLoaded]);

  const printPdf = async () => {
    if (!file || !pdfUrl || !variableFields || variableFields.length === 0 || !parsedResults) {
      setError("Missing file or variable fields to print PDF");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
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
      
      setSaveSuccess(true);
      
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Error printing PDF:", err);
      setError(`Failed to print PDF: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="pdf-processor">
      <div className="pdf-processor-header">
        <h2>PDF Processor</h2>
        <button onClick={onClose} className="close-button">×</button>
      </div>
      
      <div className="pdf-processor-content">
        <div className="main-viewer-area">
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
                className="process-button"
              >
                {isProcessing ? 'Processing...' : 'Extract Text & Bounding Boxes'}
              </button>
              
              {parsedResults && (
                <button 
                  onClick={saveBoundingBoxData}
                  className="save-button"
                  title="Save bounding box data to use on form creation page"
                  disabled={isProcessing}
                >
                  Save Bounding Box Data
                </button>
              )}

              <button 
                onClick={loadBoundingBoxData}
                className="load-button"
                title="Load bounding box data from a JSON file"
                disabled={isProcessing}
              >
                Load Bounding Box Data
              </button>

              {variableFields.length > 0 && (
                <button 
                  onClick={printPdf}
                  className="save-filled-pdf-button"
                  title="Print filled PDF with variable values"
                  disabled={isProcessing}
                >
                  Print PDF
                </button>
              )}

              {parsedResults && variableMappings.length > 0 && (
                <button 
                  onClick={toggleVariableView}
                  className="toggle-view-button"
                  title="Toggle between variables and bounding boxes"
                  disabled={isProcessing}
                >
                  {showVariables ? 'Show Bounding Boxes' : 'Show Variables'}
                </button>
              )}
            </div>
          )}

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
                  {!externalControls && (
                    <div className="pdf-controls">
                      <button 
                        onClick={() => handlePageChange(Math.max(internalCurrentPage - 1, 1))}
                        disabled={internalCurrentPage <= 1}
                      >
                        Previous
                      </button>
                      <span>
                        Page {internalCurrentPage} of {numPages}
                      </span>
                      <button 
                        onClick={() => handlePageChange(Math.min(internalCurrentPage + 1, numPages))}
                        disabled={internalCurrentPage >= numPages}
                      >
                        Next
                      </button>
                      <select 
                        value={internalScale}
                        onChange={e => setInternalScale(parseFloat(e.target.value))}
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
                    <div className="pdf-info">
                      {file && (
                        <>
                          <p>PDF: {file.name}</p>
                          <p>Pages: {numPages} | Current: {currentPage}</p>
                        </>
                      )}
                    </div>
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
                <p>No PDF document loaded</p>
                <p className="pdf-instruction">Please upload a PDF file to begin</p>
              </div>
            )}
          </div>
        </div>
        
        {/* PDF Viewer Modal */}
        {showPdfViewer && pdfUrl && (
          <PdfViewer 
            pdf={pdfUrl}
            onCancel={() => setShowPdfViewer(false)}
            visible={showPdfViewer}
            currentPage={currentPage}
            scale={scale}
            boundingBoxes={parsedResults ? parsedResults.pages.flatMap(page => page.boxes) : []}
            filledFormData={variableFields}
          />
        )}
        
        {rawResults && (
          <div className="results">
            <h3>Extracted Text:</h3>
            <div className="extracted-text-container">
              {parsedResults && parsedResults.pages && parsedResults.pages.map((page, pageIdx) => (
                <div key={pageIdx} className="page-results">
                  <h4>Page {pageIdx + 1}</h4>
                  <ul>
                    {page.boxes.map((box, boxIdx) => {
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