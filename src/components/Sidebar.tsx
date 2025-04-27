import React, { useState } from 'react';
import useCookie from '../hooks/useCookie';
import './Sidebar.css';

// Define the type for navigation items
interface NavigationItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}

// Define the type for saved PDFs
interface SavedPdf {
  id: string;
  fileName: string;
  timestamp: string;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  navigationItems: NavigationItem[];
  activeTool: string | null;
  onLoadSavedPdf?: (pdfId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  collapsed, 
  onToggle, 
  navigationItems,
  activeTool,
  onLoadSavedPdf 
}) => {
  const [savedPdfs] = useCookie('savedPdfs', '[]');

  // Format date for display
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (e) {
      return 'Unknown date';
    }
  };

  // Handle loading a saved PDF
  const handleLoadPdf = (pdfId: string) => {
    if (onLoadSavedPdf) {
      onLoadSavedPdf(pdfId);
    }
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
    <div className={`sidebar${collapsed ? ' collapsed' : ''}`}>  
      <button className="sidebar-toggle" onClick={onToggle}>
        {collapsed ? '>' : '<'}
      </button>
      
      {!collapsed && (
        <div className="sidebar-content">
          <div className="sidebar-header">
            <h2>PDF Tools</h2>
          </div>
          
          <div className="sidebar-navigation">
            {navigationItems.map((item) => (
              <div 
                key={item.id}
                className={`nav-item ${activeTool === item.id ? 'active' : ''}`}
                onClick={item.onClick}
              >
                {item.icon && <span className="nav-icon">{item.icon}</span>}
                <span className="nav-label">{item.label}</span>
              </div>
            ))}
          </div>
          
          {parsedSavedPdfs.length > 0 && (
            <div className="saved-pdfs-section">
              <h3>Saved PDFs</h3>
              <div className="saved-pdfs-list">
                {parsedSavedPdfs.map((pdf) => (
                  <div 
                    key={pdf.id} 
                    className="saved-pdf-item"
                    onClick={() => handleLoadPdf(pdf.id)}
                  >
                    <div className="pdf-name">{pdf.fileName}</div>
                    <div className="pdf-date">{formatDate(pdf.timestamp)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Sidebar;