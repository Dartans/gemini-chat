import React, { useState, useRef, useEffect } from 'react';
import { UserResource } from '@clerk/types';
import { SignOutButton } from '@clerk/clerk-react';
import useCookie from '../hooks/useCookie';
import { VariableField } from '../types/pdfTypes';
import VariableFieldsManager from './VariableFieldsManager';
import './VariableFieldsManager.css';
import './SideMenu.css';

export interface SideMenuButton {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  key?: string; // Add a key property for identifying buttons
}

export interface SavedPdf {
  id: string;
  fileName: string;
  timestamp: string;
}

export interface SideMenuProps {
  buttons: SideMenuButton[];
  onLoadSavedPdf?: (pdfId: string) => void;
  // Add variable fields manager props
  variableFields?: VariableField[];
  onVariableFieldsChange?: (fields: VariableField[]) => void;
  onMapFields?: () => void;
  isMappingInProgress?: boolean;
  showVariableFields?: boolean;
  isPdfProcessorOpen?: boolean; // Prop to indicate if PDF processor is open
  onSaveState?: () => void;     // Callback for saving state
  onRestoreState?: () => void;  // Callback for restoring state
  user?: UserResource | null;   // Add user prop from Clerk
}

const SideMenu: React.FC<SideMenuProps> = ({ 
  buttons,
  onLoadSavedPdf,
  variableFields = [],
  onVariableFieldsChange,
  onMapFields,
  isMappingInProgress = false,
  showVariableFields = false,
  isPdfProcessorOpen = false,
  onSaveState,
  onRestoreState,
  user
}) => {
  const [userName, setUserName] = useCookie('userName');
  const [savedPdfs] = useCookie('savedPdfs', '[]');
  const [userNameInput, setUserNameInput] = useState(userName || '');
  const [width, setWidth] = useState<number>(300);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [activeButton, setActiveButton] = useState<string | null>(null); // Track active button
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

  // Handle button click with state saving/restoring
  const handleButtonClick = (button: SideMenuButton) => {
    if (onSaveState && activeButton) {
      // Save current state before switching
      onSaveState();
    }
    
    // Set new active button
    setActiveButton(button.key || null);
    
    // Restore state for the new tool if needed
    if (onRestoreState && button.key) {
      // We'll restore after the button's onClick has executed
      setTimeout(() => onRestoreState(), 100);
    }
    
    // Execute the button's original onClick handler
    button.onClick();
  };

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
        {/* User Profile Section */}
        {user && (
          <div className="side-menu-section user-profile-section">
            <div className="user-info">
              <div className="user-email">{user.emailAddresses[0]?.emailAddress}</div>
              <SignOutButton>
                <button className="sign-out-button">Sign Out</button>
              </SignOutButton>
            </div>
          </div>
        )}
        
        {/* PDF Controls Section - Always shown */}
        <div className="side-menu-section">
          {buttons.map((btn, idx) => (
            <button 
              key={idx} 
              onClick={() => handleButtonClick(btn)} 
              className={`side-menu-button ${activeButton === btn.key ? 'active' : ''}`}
            >
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

            {/* User info section - Only show if not authenticated with Clerk */}
            {!user && (
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
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SideMenu;
