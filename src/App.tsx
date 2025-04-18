import React, { useState, useRef, useEffect, useCallback } from 'react';
import ApiKeyInput from './components/ApiKeyInput';
import ChatInterface from './components/ChatInterface';
import PdfProcessor, { PdfProcessorRef } from './components/PdfProcessor';
import MovementControls from './components/MovementControls';
import useCookie from './hooks/useCookie';
import SideMenu, { SideMenuButton } from './components/SideMenu';
import { BoundingBox } from './types/pdfTypes';
import './App.css';

const Sidebar: React.FC<React.PropsWithChildren<{ collapsed: boolean; onToggle: () => void }>> = ({ collapsed, onToggle, children }) => (
  <div className={`sidebar${collapsed ? ' collapsed' : ''}`}>  
    <button className="sidebar-toggle" onClick={onToggle}>
      {collapsed ? '>' : '<'}
    </button>
    {!collapsed && <div className="sidebar-content">{children}</div>}
  </div>
);

const App: React.FC = () => {
  const [apiKey] = useCookie('geminiApiKey');
  const [pdfBoundingBoxes] = useCookie('pdfBoundingBoxes', '{}');
  const [hasApiKey, setHasApiKey] = React.useState(!!apiKey);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showPdfProcessor, setShowPdfProcessor] = useState(false);
  const [loadedPdfData, setLoadedPdfData] = useState<{
    id: string;
    fileName: string;
    data: any;
    pdfData: string;
  } | undefined>(undefined);
  
  // Lift systemInstruction state up to App
  const [systemInstruction, setSystemInstruction] = useState('');
  
  // States for PDF box controls
  const [pdfBoxes, setPdfBoxes] = useState<BoundingBox[]>([]);
  const [selectedBox, setSelectedBox] = useState<BoundingBox | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

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
  }, []); // Empty dependency array as setPdfBoxes/setSelectedBox are stable
  
  const handlePageChange = useCallback((pageNumber: number, total: number) => {
    setCurrentPage(pageNumber);
    setTotalPages(total);
  }, []); // Empty dependency array
  
  const handleBoxSelect = useCallback((box: BoundingBox | null) => {
    setSelectedBox(box);
  }, []); // Empty dependency array
  
  const handleCoordinateChange = useCallback((
    field: 'x' | 'y' | 'width' | 'height',
    value: string,
    updatedBox: BoundingBox | null
  ) => {
    // Update the local state for boxes as well, if needed, or rely on PdfProcessor's internal update
    if (updatedBox) {
      setPdfBoxes(prevBoxes => prevBoxes.map(b => b.id === updatedBox.id ? updatedBox : b));
    }
    setSelectedBox(updatedBox); 
  }, []); // Empty dependency array

  // Reference to PdfProcessor methods
  const pdfProcessorRef = useRef<PdfProcessorRef>(null);
  
  // Method to select a box by ID from MovementControls - Wrap in useCallback
  const selectBoxById = useCallback((boxId: string | null) => {
    if (pdfProcessorRef.current && pdfProcessorRef.current.selectBoxById) {
      pdfProcessorRef.current.selectBoxById(boxId);
    }
  }, []); // Empty dependency array

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
        setShowPdfProcessor(true);
        return;
      }
      
      // Check if we have the old format (a single PDF object)
      if (savedPdfDataObj.id === pdfId) {
        console.log("Loading PDF from old format data structure");
        setLoadedPdfData(savedPdfDataObj);
        setShowPdfProcessor(true);
        return;
      }
      
      // Check if we have an array format
      if (Array.isArray(savedPdfDataObj)) {
        console.log("Searching in array format data structure");
        const foundPdf = savedPdfDataObj.find((pdf: any) => pdf.id === pdfId);
        if (foundPdf) {
          console.log("Found PDF in array format");
          setLoadedPdfData(foundPdf);
          setShowPdfProcessor(true);
          return;
        }
      }
      
      // If we get here, the PDF wasn't found
      console.error(`PDF not found or ID doesn't match. Looking for ID: ${pdfId}`);
    } catch (err) {
      console.error("Error loading saved PDF:", err);
    }
  }, [pdfBoundingBoxes]);

  // Example button config, add more as needed
  const sideMenuButtons: SideMenuButton[] = [
    {
      label: "Upload PDF",
      onClick: () => setShowPdfProcessor(true),
      icon: "📄"
    }
  ];

  return (
    <div className="app-layout">
      <Sidebar collapsed={sidebarCollapsed} onToggle={handleSidebarToggle}>
        {showPdfProcessor ? (
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
        ) : (
          <SideMenu
            buttons={sideMenuButtons}
            systemInstruction={systemInstruction}
            setSystemInstruction={setSystemInstruction}
            onLoadSavedPdf={handleLoadSavedPdf}
          />
        )}
      </Sidebar>
      <div className="main-content">
        {!hasApiKey ? (
          <ApiKeyInput onApiKeySubmit={handleApiKeySubmit} />
        ) : showPdfProcessor ? (
          <PdfProcessor 
            onClose={() => {
              setShowPdfProcessor(false);
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
          />
        ) : (
          <ChatInterface systemInstruction={systemInstruction} />
        )}
      </div>
    </div>
  );
};

export default App;