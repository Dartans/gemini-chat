import React, { useState, useEffect } from 'react';
import { VariableField } from '../types/pdfTypes';
import './VariableFieldsManager.css';
import useCookie from '../hooks/useCookie';

interface VariableFieldsManagerProps {
  fields: VariableField[];
  onFieldsChange: (fields: VariableField[]) => void;
  onMapFields: () => void;
  isMappingInProgress: boolean;
}

const VariableFieldsManager: React.FC<VariableFieldsManagerProps> = ({
  fields,
  onFieldsChange,
  onMapFields,
  isMappingInProgress
}) => {
  const [newFieldName, setNewFieldName] = useState('');
  const [savedFields, setSavedFields, deleteSavedFields] = useCookie('savedVariableFields', '[]');
  
  // Load saved variable fields from cookies on component mount
  useEffect(() => {
    try {
      const parsedFields = JSON.parse(savedFields);
      // Only load saved fields if there are no fields already (to avoid overriding active fields)
      if (Array.isArray(parsedFields) && parsedFields.length > 0 && fields.length === 0) {
        onFieldsChange(parsedFields);
      }
    } catch (error) {
      console.error('Error parsing saved fields from cookie:', error);
    }
  }, [savedFields, onFieldsChange, fields.length]);

  // Save fields to cookie whenever they change
  useEffect(() => {
    if (fields.length > 0) {
      setSavedFields(JSON.stringify(fields));
    }
  }, [fields, setSavedFields]);
  
  // Add a new variable field
  const handleAddField = () => {
    if (!newFieldName.trim()) return;
    
    const newField: VariableField = {
      id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newFieldName.trim(),
      value: '',
    };
    
    const updatedFields = [...fields, newField];
    onFieldsChange(updatedFields);
    setNewFieldName('');
  };
  
  // Update an existing variable field
  const handleFieldUpdate = (id: string, field: string, value: string) => {
    const updatedFields = fields.map(f => 
      f.id === id ? { ...f, [field]: value } : f
    );
    onFieldsChange(updatedFields);
  };
  
  // Remove a variable field
  const handleRemoveField = (id: string) => {
    const updatedFields = fields.filter(f => f.id !== id);
    onFieldsChange(updatedFields);
    
    // If we've removed all fields, clear the cookie
    if (updatedFields.length === 0) {
      deleteSavedFields();
    }
  };

  // Delete all saved variables
  const handleDeleteAllVariables = () => {
    onFieldsChange([]);
    deleteSavedFields();
  };
  
  return (
    <div className="variable-fields-manager">
      <h3>Form Variables</h3>
      <p className="instructions">
        Add variables to fill in the form. These will be mapped to boxes in the PDF.
      </p>
      
      <div className="add-field-container">
        <input
          type="text"
          value={newFieldName}
          onChange={(e) => setNewFieldName(e.target.value)}
          placeholder="New field name"
          className="new-field-input"
        />
        <button 
          onClick={handleAddField}
          className="add-field-button"
          title="Add new variable field"
        >
          Add
        </button>
      </div>
      
      {fields.length > 0 ? (
        <div className="fields-container">
          {fields.map((field) => (
            <div key={field.id} className="field-item">
              <div className="field-header">
                <input
                  type="text"
                  value={field.name}
                  onChange={(e) => handleFieldUpdate(field.id, 'name', e.target.value)}
                  className="field-name-input"
                />
                <button
                  onClick={() => handleRemoveField(field.id)}
                  className="remove-field-button"
                  title="Remove this field"
                >
                  ×
                </button>
              </div>
              <input
                type="text"
                value={field.value}
                onChange={(e) => handleFieldUpdate(field.id, 'value', e.target.value)}
                placeholder="Field value"
                className="field-value-input"
              />
              <div className="field-status">
                {field.boxId ? (
                  <span className="mapped-status">Mapped</span>
                ) : (
                  <span className="unmapped-status">Unmapped</span>
                )}
              </div>
            </div>
          ))}
          
          {fields.length > 0 && (
            <div className="field-actions">
              <button
                onClick={handleDeleteAllVariables}
                className="clear-fields-button"
                title="Delete all variables"
              >
                Clear All Variables
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="no-fields-message">
          No variable fields added yet. Add fields to be mapped to PDF form boxes.
        </div>
      )}
      
      {/* Map Fields button moved outside of conditional rendering to always be visible */}
      <button
        onClick={onMapFields}
        disabled={isMappingInProgress || fields.length === 0}
        className="map-fields-button"
      >
        {isMappingInProgress ? 'Mapping...' : 'Map Fields to Boxes'}
      </button>
    </div>
  );
};

export default VariableFieldsManager;