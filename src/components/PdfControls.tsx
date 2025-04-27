import React from 'react';

interface PdfControlsProps {
  currentPage: number;
  numPages: number;
  scale: number;
  onPageChange: (page: number) => void;
  onScaleChange: (scale: number) => void;
}

const PdfControls: React.FC<PdfControlsProps> = ({
  currentPage,
  numPages,
  scale,
  onPageChange,
  onScaleChange
}) => {
  return (
    <div className="pdf-controls">
      <button 
        onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
        disabled={currentPage <= 1}
      >
        Previous
      </button>
      <span>
        Page {currentPage} of {numPages}
      </span>
      <button 
        onClick={() => onPageChange(Math.min(currentPage + 1, numPages))}
        disabled={currentPage >= numPages}
      >
        Next
      </button>
      <select 
        value={scale} 
        onChange={e => onScaleChange(parseFloat(e.target.value))}
      >
        <option value="0.5">50%</option>
        <option value="0.75">75%</option>
        <option value="1">100%</option>
        <option value="1.25">125%</option>
        <option value="1.5">150%</option>
      </select>
    </div>
  );
};

export default PdfControls;