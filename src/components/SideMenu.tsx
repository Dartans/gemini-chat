import React, { useState, useRef, useEffect } from 'react';
import useCookie from '../hooks/useCookie';
import { VariableField } from '../types/pdfTypes';
import VariableFieldsManager from './VariableFieldsManager';
import './VariableFieldsManager.css';
import './SideMenu.css';

export interface SideMenuButton {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

export interface SavedPdf {
  id: string;
  fileName: string;
  timestamp: string;
}

export interface SideMenuProps {
  buttons: SideMenuButton[];
  systemInstruction: string;
  setSystemInstruction: (value: string) => void;
  onLoadSavedPdf?: (pdfId: string) => void;
  // Add variable fields manager props
  variableFields?: VariableField[];
  onVariableFieldsChange?: (fields: VariableField[]) => void;
  onMapFields?: () => void;
  isMappingInProgress?: boolean;
  showVariableFields?: boolean;
  isPdfProcessorOpen?: boolean; // Prop to indicate if PDF processor is open
}

const SideMenu: React.FC<SideMenuProps> = ({ 
  buttons,
  systemInstruction,
  setSystemInstruction,
  onLoadSavedPdf,
  variableFields = [],
  onVariableFieldsChange,
  onMapFields,
  isMappingInProgress = false,
  showVariableFields = false,
  isPdfProcessorOpen = false
}) => {
  const [userName, setUserName] = useCookie('userName');
  const [savedPdfs] = useCookie('savedPdfs', '[]');
  const [fullRequest, setFullRequest] = useState<string>('');
  const [userNameInput, setUserNameInput] = useState(userName || '');
  const [width, setWidth] = useState<number>(300);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const sideMenuRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  
  const handleSaveUserName = () => {
    setUserName(userNameInput, { expires: 365 });
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (e) {
      return 'Unknown date';
    }
  };

  const handleLoadPdf = (pdfId: string) => {
    if (onLoadSavedPdf) {
      onLoadSavedPdf(pdfId);
    }
  };

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setFullRequest(e.detail);
    };
    window.addEventListener('updateFullRequest', handler as EventListener);
    return () => window.removeEventListener('updateFullRequest', handler as EventListener);
  }, []);

  // Mouse down event handler for resizer
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  // Handle resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = e.clientX;
      
      // Set min and max constraints
      if (newWidth >= 250 && newWidth <= 500) {
        setWidth(newWidth);
        
        if (sideMenuRef.current) {
          sideMenuRef.current.style.width = `${newWidth}px`;
        }
      }
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
    };
    
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Parse the saved PDFs
  const parsedSavedPdfs: SavedPdf[] = (() => {
    try {
      return JSON.parse(savedPdfs);
    } catch (e) {
      return [];
    }
  })();

  return (
    <div 
      className={`side-menu ${isPdfProcessorOpen ? 'pdf-processor-active' : ''}`} 
      ref={sideMenuRef} 
      style={{ width: `${width}px` }}
    >
      <div 
        className={`side-menu-resizer ${isResizing ? 'resizing' : ''}`} 
        ref={resizerRef}
        onMouseDown={handleMouseDown}
      />
      <div className="side-menu-content">
        {/* PDF Controls Section - Always shown */}
        <div className="side-menu-section">
          {buttons.map((btn, idx) => (
            <button key={idx} onClick={btn.onClick} className="side-menu-button">
              {btn.icon && <span className="button-icon">{btn.icon}</span>}
              <span>{btn.label}</span>
            </button>
          ))}
        </div>
        
        {/* Variable Fields Manager - Always shown when showVariableFields is true */}
        {showVariableFields && onVariableFieldsChange && onMapFields && (
          <div className="side-menu-section side-menu-variable-fields">
            <VariableFieldsManager
              fields={variableFields}
              onFieldsChange={onVariableFieldsChange}
              onMapFields={onMapFields}
              isMappingInProgress={isMappingInProgress}
            />
          </div>
        )}
        
        {/* Only show these sections when PDF processor is not open */}
        {!isPdfProcessorOpen && (
          <>
            {/* Saved PDFs section */}
            {parsedSavedPdfs.length > 0 && (
              <div className="saved-pdfs-section">
                <h3 className="side-menu-label">Saved PDFs</h3>
                {parsedSavedPdfs.map((pdf) => (
                  <div 
                    key={pdf.id} 
                    className="saved-pdf-item"
                    onClick={() => handleLoadPdf(pdf.id)}
                  >
                    <div>{pdf.fileName}</div>
                    <div style={{ fontSize: '10px', opacity: 0.7 }}>{formatDate(pdf.timestamp)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* User info section */}
            <div className="side-menu-section">
              <label htmlFor="sidebar-username" className="side-menu-label">User Name:</label>
              <input
                id="sidebar-username"
                type="text"
                value={userNameInput}
                onChange={e => setUserNameInput(e.target.value)}
                placeholder="Enter your name"
                className="side-menu-input"
              />
              <button 
                onClick={handleSaveUserName} 
                className="side-menu-button"
              >
                Save
              </button>
            </div>

            {/* System instruction section */}
            <div className="side-menu-section">
              <label htmlFor="systemInstruction" className="side-menu-label">System Instruction:</label>
              <textarea
                id="systemInstruction"
                value={systemInstruction}
                onChange={e => setSystemInstruction(e.target.value)}
                placeholder="Enter instructions for the AI (e.g., You are a helpful assistant)."
                className="side-menu-textarea"
              />
            </div>
            
            {/* Full AI Request section in footer */}
            <div className="side-menu-footer">
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Full AI Request:</div>
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{fullRequest}</pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SideMenu;
