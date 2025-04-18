import React, { useState } from 'react';
import useCookie from '../hooks/useCookie';

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
  setSystemInstruction: React.Dispatch<React.SetStateAction<string>>;
  onLoadSavedPdf?: (pdfId: string) => void;
}

const SideMenu: React.FC<SideMenuProps> = ({ buttons, systemInstruction, setSystemInstruction, onLoadSavedPdf }) => {
  const [userName, setUserName] = useCookie('userName');
  const [savedPdfs] = useCookie('savedPdfs', '[]');
  const [fullRequest, setFullRequest] = React.useState<string>('');
  const [userNameInput, setUserNameInput] = React.useState(userName || '');
  const [showSavedPdfs, setShowSavedPdfs] = useState(false);
  
  const handleSaveUserName = () => {
    setUserName(userNameInput, { expires: 365 });
  };

  // Parse saved PDFs from cookie
  const parsedSavedPdfs: SavedPdf[] = React.useMemo(() => {
    try {
      return JSON.parse(savedPdfs || '[]') as SavedPdf[];
    } catch (e) {
      console.error("Error parsing saved PDFs:", e);
      return [];
    }
  }, [savedPdfs]);

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

  React.useEffect(() => {
    const handler = (e: CustomEvent) => {
      setFullRequest(e.detail);
    };
    window.addEventListener('updateFullRequest', handler as EventListener);
    return () => window.removeEventListener('updateFullRequest', handler as EventListener);
  }, []);

  return (
    <>
      <div style={{ marginBottom: 16, overflowY: 'auto', overflowX: 'hidden', maxHeight: '100vh', boxSizing: 'border-box' }}>
        <label htmlFor="sidebar-username" style={{ color: '#fff', fontSize: 14 }}>User Name:</label>
        <input
          id="sidebar-username"
          type="text"
          value={userNameInput}
          onChange={e => setUserNameInput(e.target.value)}
          placeholder="Enter your name"
          style={{ width: '100%', marginTop: 4, marginBottom: 8, padding: 4, borderRadius: 4, border: '1px solid #ccc' }}
        />
        <button onClick={handleSaveUserName} style={{ width: '100%', padding: 4, borderRadius: 4, background: '#444', color: '#fff', border: 'none', cursor: 'pointer' }}>Save</button>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="systemInstruction" style={{ color: '#fff', fontSize: 14 }}>System Instruction:</label>
          <textarea
            id="systemInstruction"
            value={systemInstruction}
            onChange={e => setSystemInstruction(e.target.value)}
            placeholder="Enter instructions for the AI (e.g., You are a helpful assistant)."
            style={{ width: '100%', marginTop: 4, marginBottom: 8, padding: 4, borderRadius: 4, border: '1px solid #ccc', minHeight: 60 }}
          />
        </div>
        {buttons.map((btn, idx) => (
          <button key={idx} onClick={btn.onClick} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {btn.icon}
            {btn.label}
          </button>
        ))}
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setShowSavedPdfs(!showSavedPdfs)} style={{ width: '100%', padding: 4, borderRadius: 4, background: '#444', color: '#fff', border: 'none', cursor: 'pointer' }}>
            {showSavedPdfs ? 'Hide Saved PDFs' : 'Show Saved PDFs'}
          </button>
          {showSavedPdfs && (
            <div style={{ marginTop: 8 }}>
              {parsedSavedPdfs.length === 0 ? (
                <div style={{ color: '#fff', fontSize: 14 }}>No saved PDFs found.</div>
              ) : (
                parsedSavedPdfs.map(pdf => (
                  <div key={pdf.id} style={{ marginBottom: 8, padding: 8, border: '1px solid #ccc', borderRadius: 4, background: '#333', color: '#fff' }}>
                    <div style={{ fontSize: 14, fontWeight: 'bold' }}>{pdf.fileName}</div>
                    <div style={{ fontSize: 12 }}>{formatDate(pdf.timestamp)}</div>
                    <button onClick={() => handleLoadPdf(pdf.id)} style={{ marginTop: 4, padding: 4, borderRadius: 4, background: '#444', color: '#fff', border: 'none', cursor: 'pointer' }}>Load PDF</button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ marginTop: 'auto', background: '#181818', color: '#fff', padding: 10, fontSize: 12, borderTop: '1px solid #333', wordBreak: 'break-all' }}>
        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Full AI Request:</div>
        <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{fullRequest}</pre>
      </div>
    </>
  );
};

export default SideMenu;
