import React from 'react';
import { UserResource } from '@clerk/types';
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
  user?: UserResource | null;   // Add user prop from Clerk
}

const Sidebar: React.FC<SidebarProps> = ({ 
  collapsed, 
  onToggle, 
  navigationItems,
  activeTool,
  onLoadSavedPdf,
  onSaveState,
  onRestoreState,
  user
}) => {
  const [savedPdfs] = useCookie('savedPdfs', '[]');

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
            {user && (
              <div className="sidebar-user-info">
                <img 
                  src={user.imageUrl} 
                  alt={user.firstName || 'User'} 
                  className="sidebar-user-avatar" 
                />
                <span className="sidebar-username">{user.firstName || user.username}</span>
              </div>
            )}
          </div>
          
          {/* Replace with SideMenu component */}
          <SideMenu
            buttons={sideMenuButtons}
            onLoadSavedPdf={onLoadSavedPdf}
            isPdfProcessorOpen={activeTool === 'pdfProcessor'}
            onSaveState={onSaveState}         // Pass save state handler
            onRestoreState={onRestoreState}   // Pass restore state handler
            user={user}                       // Pass user to SideMenu
          />
        </div>
      )}
    </div>
  );
};

export default Sidebar;