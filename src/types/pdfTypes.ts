export interface BoundingBox {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  id?: string; // Unique ID for box identification
}

export interface PdfResults {
  pages: Array<{
    boxes: BoundingBox[];
  }>;
}

// New types for variable mapping
export interface VariableField {
  id: string;
  name: string;
  value: string;
  boxId?: string; // ID of mapped bounding box
}

export interface VariableMapping {
  fieldId: string;
  boxId: string;
}

export interface FieldMappingResult {
  mappings: VariableMapping[];
  unmappedBoxes: string[]; // Box IDs that couldn't be mapped
}