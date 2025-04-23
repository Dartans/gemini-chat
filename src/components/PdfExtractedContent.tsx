import React from 'react';
import { BoundingBox, VariableField } from '../types/pdfTypes';
import './PdfExtractedContent.css';

interface PdfExtractedContentProps {
  parsedResults: {
    pages: {
      boxes: BoundingBox[];
    }[];
  } | null;
  selectedBox: BoundingBox | null;
  currentPage: number;
  variableFields: VariableField[];
  onBoxClick: (box: BoundingBox, targetPage?: number) => void;
}

const PdfExtractedContent: React.FC<PdfExtractedContentProps> = ({
  parsedResults,
  selectedBox,
  currentPage,
  variableFields,
  onBoxClick
}) => {
  if (!parsedResults) return null;

  return (
    <div className="pdf-extracted-content">
      <h3>Extracted Text:</h3>
      <div className="extracted-text-container">
        {parsedResults.pages.map((page, pageIdx) => (
          <div key={pageIdx} className="page-results">
            <h4>Page {pageIdx + 1}</h4>
            <ul>
              {page.boxes.map((box, boxIdx) => {
                // Find if this box has a mapped variable
                const mappedField = variableFields.find(field => field.boxId === box.id);
                
                return (
                  <li 
                    key={boxIdx} 
                    className={selectedBox?.id === box.id ? 'selected-box-result' : ''}
                    onClick={() => {
                      if (box.page === currentPage) {
                        onBoxClick(box);
                      } else {
                        onBoxClick(box, box.page);
                      }
                    }}
                  >
                    <div className="box-text">"{box.text}"</div>
                    {mappedField && (
                      <div className="mapped-field">
                        → {mappedField.name}: {mappedField.value || '[empty]'}
                      </div>
                    )}
                    <div className="box-coordinates">
                      (x:{box.x}, y:{box.y}, w:{box.width}, h:{box.height})
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PdfExtractedContent;