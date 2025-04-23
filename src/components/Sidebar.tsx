import React from 'react';
import './Sidebar.css';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, children }) => (
  <div className={`sidebar${collapsed ? ' collapsed' : ''}`}>  
    <button className="sidebar-toggle" onClick={onToggle}>
      {collapsed ? '>' : '<'}
    </button>
    {!collapsed && <div className="sidebar-content">{children}</div>}
  </div>
);

export default Sidebar;