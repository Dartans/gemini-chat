import React from 'react';
import { BoundingBox } from '../types/pdfTypes'; // We'll create this type file next

interface MovementControlsProps {
  selectedBox: BoundingBox | null;
  onCoordinateChange: (field: 'x' | 'y' | 'width' | 'height', value: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (pageNumber: number) => void;
  onBoxSelect: (boxId: string | null) => void;
  allBoxes: BoundingBox[];
}

const MovementControls: React.FC<MovementControlsProps> = ({
  selectedBox,
  onCoordinateChange,
  currentPage,
  totalPages,
  onPageChange,
  onBoxSelect,
  allBoxes,
}) => {
  // Get boxes for current page
  const currentPageBoxes = allBoxes.filter(box => box.page === currentPage);

  return (
    <>
      <div style={{ marginBottom: 16, overflowY: 'auto', overflowX: 'hidden', maxHeight: '100vh', boxSizing: 'border-box' }}>
        <h3 style={{ color: '#fff', marginTop: 0 }}>PDF Controls</h3>
        
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ color: '#fff', marginBottom: 8 }}>Page Navigation</h4>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button 
              onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
              disabled={currentPage <= 1}
              style={{ flex: 1, padding: '6px', borderRadius: '4px', cursor: currentPage > 1 ? 'pointer' : 'not-allowed' }}
            >
              Previous
            </button>
            <span style={{ color: '#fff', display: 'flex', alignItems: 'center' }}>
              {currentPage} / {totalPages}
            </span>
            <button 
              onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
              disabled={currentPage >= totalPages}
              style={{ flex: 1, padding: '6px', borderRadius: '4px', cursor: currentPage < totalPages ? 'pointer' : 'not-allowed' }}
            >
              Next
            </button>
          </div>
        </div>
        
        {selectedBox ? (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ color: '#fff', marginBottom: 8 }}>Box Coordinates</h4>
            <div style={{ color: '#ddd', marginBottom: 8, padding: 8, backgroundColor: '#333', borderRadius: 4 }}>
              <p style={{ margin: '0 0 8px 0', fontStyle: 'italic' }}>"{selectedBox.text}"</p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                X:
                <input 
                  type="number"
                  value={selectedBox.x}
                  onChange={(e) => onCoordinateChange('x', e.target.value)}
                  style={{ width: '70px', padding: '4px', borderRadius: '4px' }}
                />
              </label>
              <label style={{ color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Y:
                <input 
                  type="number"
                  value={selectedBox.y}
                  onChange={(e) => onCoordinateChange('y', e.target.value)}
                  style={{ width: '70px', padding: '4px', borderRadius: '4px' }}
                />
              </label>
              <label style={{ color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Width:
                <input 
                  type="number"
                  value={selectedBox.width}
                  onChange={(e) => onCoordinateChange('width', e.target.value)}
                  style={{ width: '70px', padding: '4px', borderRadius: '4px' }}
                />
              </label>
              <label style={{ color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Height:
                <input 
                  type="number"
                  value={selectedBox.height}
                  onChange={(e) => onCoordinateChange('height', e.target.value)}
                  style={{ width: '70px', padding: '4px', borderRadius: '4px' }}
                />
              </label>
            </div>
            
            <button 
              onClick={() => onBoxSelect(null)} 
              style={{ width: '100%', marginTop: 12, padding: '6px', borderRadius: '4px', background: '#555' }}
            >
              Clear Selection
            </button>
          </div>
        ) : (
          <div style={{ padding: 12, color: '#ddd', textAlign: 'center', borderRadius: 4, backgroundColor: '#333', marginBottom: 16 }}>
            <p>Click on a box to select it</p>
          </div>
        )}
        
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ color: '#fff', marginBottom: 8 }}>Boxes on Current Page</h4>
          {currentPageBoxes.length > 0 ? (
            <div style={{ maxHeight: '200px', overflowY: 'auto', backgroundColor: '#333', borderRadius: 4, padding: 2 }}>
              {currentPageBoxes.map((box, idx) => (
                <div 
                  key={box.id || idx}
                  onClick={() => onBoxSelect(box.id || '')}
                  style={{
                    padding: '8px',
                    margin: '4px',
                    backgroundColor: selectedBox?.id === box.id ? '#4a4a4a' : '#2a2a2a',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9em',
                    wordBreak: 'break-word',
                    borderLeft: selectedBox?.id === box.id ? '3px solid #1976d2' : 'none'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '4px', color: selectedBox?.id === box.id ? '#90caf9' : '#eee' }}>
                    Box {idx + 1}
                  </div>
                  <div style={{ color: '#ddd' }}>{box.text.substring(0, 40) + (box.text.length > 40 ? '...' : '')}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 12, color: '#999', textAlign: 'center', borderRadius: 4, backgroundColor: '#2a2a2a' }}>
              <p>No boxes on current page</p>
            </div>
          )}
        </div>
        
        <div style={{ backgroundColor: '#333', padding: 12, borderRadius: 4 }}>
          <h4 style={{ color: '#fff', margin: '0 0 8px 0' }}>Help</h4>
          <ul style={{ color: '#ddd', margin: 0, paddingLeft: 20 }}>
            <li>Click on boxes to select them</li>
            <li>Drag selected boxes to move them</li>
            <li>Edit coordinates directly in fields</li>
          </ul>
        </div>
      </div>
    </>
  );
};

export default MovementControls;