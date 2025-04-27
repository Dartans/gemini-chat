import React, { useState, useRef, useCallback } from 'react';
import ApiKeyInput from './components/ApiKeyInput';
import PdfProcessor, { PdfProcessorRef } from './components/PdfProcessor';
import VariableFieldsManager from './components/VariableFieldsManager';
import MovementControls from './components/MovementControls';
import useCookie from './hooks/useCookie';
import Sidebar from './components/Sidebar';
import { BoundingBox, VariableField } from './types/pdfTypes';
import './App.css';

// Define tool types for our application
type Tool = 'pdfProcessor' | 'variableEditor';

const App: React.FC = () => {
  const [apiKey] = useCookie('geminiApiKey');
  const [pdfBoundingBoxes] = useCookie('pdfBoundingBoxes', '{}');
  const [hasApiKey, setHasApiKey] = React.useState(!!apiKey);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTool, setActiveTool] = useState<Tool | null>(null);
  const [loadedPdfData, setLoadedPdfData] = useState<{
    id: string;
    fileName: string;
    data: any;
    pdfData: string;
  } | undefined>(undefined);
  
  // States for PDF box controls
  const [pdfBoxes, setPdfBoxes] = useState<BoundingBox[]>([]);
  const [selectedBox, setSelectedBox] = useState<BoundingBox | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Variable fields state
  const [variableFields, setVariableFields] = useState<VariableField[]>([]);
  const [isMappingInProgress, setIsMappingInProgress] = useState(false);
  
  // Handler for variable fields change
  const handleVariableFieldsChange = useCallback((fields: VariableField[]) => {
    setVariableFields(fields);
    // Update boxes in PdfProcessor if variable field changes affect them (e.g., name change)
    if (pdfProcessorRef.current?.updateBoxNames) {
       pdfProcessorRef.current.updateBoxNames(fields);
    }
  }, []);

  // Handler for mapping fields
  const handleMapFields = useCallback(async () => {
    if (pdfProcessorRef.current && pdfProcessorRef.current.mapFields) {
      setIsMappingInProgress(true);
      try {
        // Pass current fields to mapFields
        const updatedFields = await pdfProcessorRef.current.mapFields(variableFields);
        if (updatedFields) {
          setVariableFields(updatedFields); // Update state with results
        }
      } finally {
        setIsMappingInProgress(false);
      }
    }
  }, [variableFields]);

  const handleApiKeySubmit = () => {
    setHasApiKey(true);
  };

  const handleSidebarToggle = () => {
    setSidebarCollapsed((prev) => !prev);
  };
  
  // Wrap handlers in useCallback
  const handleBoxesLoaded = useCallback((boxes: BoundingBox[], selected: BoundingBox | null) => {
    setPdfBoxes(boxes);
    setSelectedBox(selected);
  }, []); 
  
  const handlePageChange = useCallback((pageNumber: number, total: number) => {
    setCurrentPage(pageNumber);
    setTotalPages(total);
  }, []); 
  
  const handleBoxSelect = useCallback((box: BoundingBox | null) => {
    setSelectedBox(box);
  }, []); 
  
  const handleCoordinateChange = useCallback((
    field: 'x' | 'y' | 'width' | 'height',
    value: string,
    updatedBox: BoundingBox | null
  ) => {
    if (updatedBox) {
      setPdfBoxes(prevBoxes => prevBoxes.map(b => b.id === updatedBox.id ? updatedBox : b));
    }
    setSelectedBox(updatedBox); 
  }, []);

  // Reference to PdfProcessor methods
  const pdfProcessorRef = useRef<PdfProcessorRef>(null);
  
  // Method to select a box by ID from MovementControls
  const selectBoxById = useCallback((boxId: string | null) => {
    if (pdfProcessorRef.current && pdfProcessorRef.current.selectBoxById) {
      pdfProcessorRef.current.selectBoxById(boxId);
    }
  }, []);

  // Handler for loading a saved PDF from the side menu
  const handleLoadSavedPdf = useCallback((pdfId: string) => {
    try {
      // Get the PDF data from cookie
      const savedPdfDataObj = JSON.parse(pdfBoundingBoxes || '{}');
      
      console.log("Attempting to load PDF with ID:", pdfId);
      console.log("Available PDF data:", savedPdfDataObj);
      
      // Check if we have the new format (an object of PDFs)
      if (savedPdfDataObj[pdfId] && savedPdfDataObj[pdfId].id === pdfId) {
        console.log("Loading PDF from new format data structure");
        const pdfData = savedPdfDataObj[pdfId];
        setLoadedPdfData(pdfData);
        setActiveTool('pdfProcessor');
        return;
      }
      
      // Check if we have the old format (a single PDF object)
      if (savedPdfDataObj.id === pdfId) {
        console.log("Loading PDF from old format data structure");
        setLoadedPdfData(savedPdfDataObj);
        setActiveTool('pdfProcessor');
        return;
      }
      
      // Check if we have an array format
      if (Array.isArray(savedPdfDataObj)) {
        console.log("Searching in array format data structure");
        const foundPdf = savedPdfDataObj.find((pdf: any) => pdf.id === pdfId);
        if (foundPdf) {
          console.log("Found PDF in array format");
          setLoadedPdfData(foundPdf);
          setActiveTool('pdfProcessor');
          return;
        }
      }
      
      console.error(`PDF not found or ID doesn't match. Looking for ID: ${pdfId}`);
    } catch (err) {
      console.error("Error loading saved PDF:", err);
    }
  }, [pdfBoundingBoxes]);

  // Navigation items for the sidebar
  const navigationItems = [
    {
      id: 'pdfProcessor',
      label: "PDF Processor",
      icon: "📄",
      onClick: () => setActiveTool('pdfProcessor')
    },
    {
      id: 'variableEditor',
      label: "Variable Editor",
      icon: "✏️",
      onClick: () => setActiveTool('variableEditor')
    }
  ];

  // Render main content based on active tool
  const renderMainContent = () => {
    if (!hasApiKey) {
      return <ApiKeyInput onApiKeySubmit={handleApiKeySubmit} />;
    }

    if (!activeTool) {
      return (
        <div className="tools-landing-page">
          <h1>Welcome to PDF Tools</h1>
          <p>Select a tool from the sidebar to get started:</p>
          
          <div className="tools-grid">
            {navigationItems.map(item => (
              <div key={item.id} className="tool-card" onClick={item.onClick}>
                <div className="tool-icon">{item.icon}</div>
                <h3>{item.label}</h3>
                {item.id === 'pdfProcessor' && (
                  <p>Upload, process, and extract data from PDF files.</p>
                )}
                {item.id === 'variableEditor' && (
                  <p>Create and manage variables for PDF form filling.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    switch (activeTool) {
      case 'pdfProcessor':
        return (
          <div className="tool-container">
            <PdfProcessor 
              onClose={() => {
                setActiveTool(null);
                setPdfBoxes([]);
                setSelectedBox(null);
                setLoadedPdfData(undefined);
              }}
              onBoxesLoaded={handleBoxesLoaded}
              onPageChange={handlePageChange}
              onBoxSelect={handleBoxSelect}
              onCoordinateChange={handleCoordinateChange}
              externalControls={true}
              ref={pdfProcessorRef}
              loadedPdfData={loadedPdfData}
              variableFields={variableFields}
              onVariableFieldsChange={setVariableFields}
            />
            <div className="tool-side-controls">
              {/* File upload section */}
              <div className="control-section">
                <h3>File Controls</h3>
                <div className="file-upload">
                  <input 
                    type="file" 
                    accept=".pdf" 
                    onChange={(e) => {
                      if (pdfProcessorRef.current && pdfProcessorRef.current.handleFileChange) {
                        pdfProcessorRef.current.handleFileChange(e);
                      }
                    }}
                    disabled={pdfProcessorRef.current?.isProcessing}
                  />
                </div>
              </div>

              {/* PDF processing controls */}
              <div className="control-section">
                <h3>PDF Processing</h3>
                <button 
                  onClick={() => {
                    if (pdfProcessorRef.current && pdfProcessorRef.current.processFile) {
                      pdfProcessorRef.current.processFile();
                    }
                  }}
                  disabled={!pdfProcessorRef.current || pdfProcessorRef.current?.isProcessing}
                  className="process-button"
                >
                  {pdfProcessorRef.current?.isProcessing ? 'Processing...' : 'Extract Text & Boxes'}
                </button>

                <button 
                  onClick={handleMapFields}
                  disabled={isMappingInProgress || !pdfProcessorRef.current}
                  className="map-fields-button"
                >
                  {isMappingInProgress ? 'Mapping...' : 'Map Fields'}
                </button>
                
                <button 
                  onClick={() => {
                    if (pdfProcessorRef.current && pdfProcessorRef.current.toggleVariableView) {
                      pdfProcessorRef.current.toggleVariableView();
                    }
                  }}
                  className="toggle-view-button"
                  disabled={!pdfProcessorRef.current}
                >
                  Toggle View
                </button>
              </div>
              
              {/* PDF data management */}
              <div className="control-section">
                <h3>Data Management</h3>
                <button 
                  onClick={() => {
                    if (pdfProcessorRef.current && pdfProcessorRef.current.saveBoundingBoxData) {
                      pdfProcessorRef.current.saveBoundingBoxData();
                    }
                  }}
                  className="save-button"
                  disabled={!pdfProcessorRef.current}
                >
                  Save Bounding Box Data
                </button>
                
                <button 
                  onClick={() => {
                    if (pdfProcessorRef.current && pdfProcessorRef.current.loadBoundingBoxData) {
                      pdfProcessorRef.current.loadBoundingBoxData();
                    }
                  }}
                  className="load-button"
                  disabled={!pdfProcessorRef.current}
                >
                  Load Bounding Box Data
                </button>
                
                <button 
                  onClick={() => {
                    if (pdfProcessorRef.current && pdfProcessorRef.current.printPdf) {
                      pdfProcessorRef.current.printPdf();
                    }
                  }}
                  className="print-button"
                  disabled={!pdfProcessorRef.current}
                >
                  Print PDF
                </button>
              </div>
                
              {/* Box movement controls */}
              <div className="control-section">
                <h3>Box Controls</h3>
                <MovementControls 
                  selectedBox={selectedBox}
                  onCoordinateChange={(field, value) => {
                    if (pdfProcessorRef.current) {
                      const pdfProcessor = pdfProcessorRef.current;
                      const handleCoordinateChange = pdfProcessor.handleCoordinateChange;
                      if (handleCoordinateChange) {
                        handleCoordinateChange(field, value);
                      }
                    }
                  }}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(pageNumber) => {
                    if (pdfProcessorRef.current && pdfProcessorRef.current.handlePageChange) {
                      pdfProcessorRef.current.handlePageChange(pageNumber);
                    } else {
                      setCurrentPage(pageNumber);
                    }
                  }}
                  onBoxSelect={selectBoxById}
                  allBoxes={pdfBoxes}
                />
              </div>
            </div>
          </div>
        );
      
      case 'variableEditor':
        return (
          <div className="tool-container">
            <div className="variable-editor-container">
              <h2>Variable Fields Editor</h2>
              <p>Create and manage variables that can be mapped to PDF form fields.</p>
              
              <VariableFieldsManager
                fields={variableFields}
                onFieldsChange={handleVariableFieldsChange}
                onMapFields={handleMapFields}
                isMappingInProgress={isMappingInProgress}
              />
              
              {variableFields.length > 0 && (
                <div className="variable-actions">
                  <button
                    onClick={() => setActiveTool('pdfProcessor')}
                    className="apply-to-pdf-button"
                  >
                    Apply to PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      
      default:
        return <div>Select a tool from the sidebar</div>;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar 
        collapsed={sidebarCollapsed} 
        onToggle={handleSidebarToggle}
        navigationItems={navigationItems}
        activeTool={activeTool}
        onLoadSavedPdf={handleLoadSavedPdf}
      />
      <div className="main-content">
        {renderMainContent()}
      </div>
    </div>
  );
};

export default App;