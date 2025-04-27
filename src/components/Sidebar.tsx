import React, { useState } from 'react';
import useCookie from '../hooks/useCookie';
import SideMenu, { SideMenuButton } from './SideMenu';
import './Sidebar.css';

// Define the type for navigation items
interface NavigationItem {
  id: string;
  key?: string;
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
  onSaveState?: () => void;     // Add prop for saving state
  onRestoreState?: () => void;  // Add prop for restoring state
}

const Sidebar: React.FC<SidebarProps> = ({ 
  collapsed, 
  onToggle, 
  navigationItems,
  activeTool,
  onLoadSavedPdf,
  onSaveState,
  onRestoreState
}) => {
  const [savedPdfs] = useCookie('savedPdfs', '[]');
  const [systemInstruction, setSystemInstruction] = useState<string>('');

  // Convert navigation items to SideMenuButtons
  const sideMenuButtons: SideMenuButton[] = navigationItems.map(item => ({
    label: item.label,
    onClick: item.onClick,
    icon: item.icon,
    key: item.key || item.id
  }));

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
          
          {/* Replace with SideMenu component */}
          <SideMenu
            buttons={sideMenuButtons}
            systemInstruction={systemInstruction}
            setSystemInstruction={setSystemInstruction}
            onLoadSavedPdf={onLoadSavedPdf}
            isPdfProcessorOpen={activeTool === 'pdfProcessor'}
            onSaveState={onSaveState}         // Pass save state handler
            onRestoreState={onRestoreState}   // Pass restore state handler
          />
        </div>
      )}
    </div>
  );
};

export default Sidebar;