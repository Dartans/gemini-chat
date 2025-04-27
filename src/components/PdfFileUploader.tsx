import React, { useState } from 'react';
import './PdfFileUploader.css';

interface PdfFileUploaderProps {
  file: File | null;
  isProcessing: boolean;
  onFileChange: (file: File) => void;
  onProcessFile: () => void;
  onSaveData: () => void;
  onLoadData: () => void;
  onPrintPdf: () => void;
  onToggleView: () => void;
  saveSuccess: boolean;
  error: string | null;
  showSaveButton: boolean;
  showPrintButton: boolean;
  showToggleButton: boolean;
}

const PdfFileUploader: React.FC<PdfFileUploaderProps> = ({
  file,
  isProcessing,
  onFileChange,
  onProcessFile,
  onSaveData,
  onLoadData,
  onPrintPdf,
  onToggleView,
  saveSuccess,
  error,
  showSaveButton,
  showPrintButton,
  showToggleButton
}) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onFileChange(event.target.files[0]);
    }
  };

  return (
    <div className="pdf-file-uploader">
      <div className="file-upload-controls">
        <input 
          type="file" 
          accept=".pdf" 
          onChange={handleFileChange} 
          disabled={isProcessing} 
        />
        <button 
          onClick={onProcessFile} 
          disabled={!file || isProcessing}
          className="process-button"
        >
          {isProcessing ? 'Processing...' : 'Extract Text & Bounding Boxes'}
        </button>
        
        {/* Save Bounding Box Data button */}
        {showSaveButton && (
          <button 
            onClick={onSaveData}
            className="save-button"
            title="Save bounding box data to use on form creation page"
          >
            Save Bounding Box Data
          </button>
        )}

        {/* Load Bounding Box Data button */}
        <button 
          onClick={onLoadData}
          className="load-button"
          title="Load bounding box data from a JSON file"
        >
          Load Bounding Box Data
        </button>

        {/* Print PDF button */}
        {showPrintButton && (
          <button 
            onClick={onPrintPdf}
            className="save-filled-pdf-button"
            title="Print filled PDF with variable values"
          >
            Print PDF
          </button>
        )}

        {/* Toggle view button */}
        {showToggleButton && (
          <button 
            onClick={onToggleView}
            className="toggle-view-button"
            title="Toggle between variables and bounding boxes"
          >
            Toggle View
          </button>
        )}

        {/* Success message notification */}
        {saveSuccess && (
          <div className="success-message">
            Operation completed successfully!
          </div>
        )}
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
};

export default PdfFileUploader;