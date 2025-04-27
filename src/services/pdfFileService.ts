import { PdfResults, VariableField } from "../types/pdfTypes";

/**
 * Handle PDF file changes and create base64 representation
 * @param file The PDF file to process
 * @returns Object containing the objectUrl, rawPdfData as base64, and any error
 */
export const handlePdfFileChange = async (
  file: File
): Promise<{
  objectUrl: string;
  rawPdfData: string | null;
  error: string | null;
}> => {
  try {
    // Create object URL for rendering the PDF
    const objectUrl = URL.createObjectURL(file);
    
    // Read the PDF file as base64 for storage
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target && e.target.result) {
          // Get base64 string (remove metadata prefix)
          const base64String = e.target.result.toString().split(',')[1];
          resolve({
            objectUrl,
            rawPdfData: base64String,
            error: null
          });
        } else {
          resolve({
            objectUrl,
            rawPdfData: null,
            error: "Failed to read PDF file as base64"
          });
        }
      };
      
      reader.onerror = () => {
        resolve({
          objectUrl,
          rawPdfData: null,
          error: "Error reading the PDF file"
        });
      };
      
      reader.readAsDataURL(file);
    });
  } catch (err) {
    return {
      objectUrl: "",
      rawPdfData: null,
      error: `Error handling PDF file: ${err instanceof Error ? err.message : String(err)}`
    };
  }
};

/**
 * Create a File object from a base64 PDF string
 * @param base64Data Base64 encoded PDF data
 * @param fileName Name to give the created file
 * @returns Object containing the file, objectUrl, and any error
 */
export const createPdfFileFromBase64 = (
  base64Data: string,
  fileName: string
): {
  file: File | null;
  objectUrl: string;
  error: string | null;
} => {
  try {
    // Convert base64 back to blob
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    
    // Create a File object from the blob
    const pdfFile = new File([blob], fileName, { type: 'application/pdf' });
    const objectUrl = URL.createObjectURL(blob);
    
    return {
      file: pdfFile,
      objectUrl,
      error: null
    };
  } catch (err) {
    return {
      file: null,
      objectUrl: "",
      error: `Error creating PDF file from base64: ${err instanceof Error ? err.message : String(err)}`
    };
  }
};

/**
 * Save PDF bounding box data to a JSON file and trigger download
 * @param parsedResults Parsed PDF results with bounding boxes
 * @param rawPdfData Base64 encoded PDF data
 * @param file Original PDF file
 * @param variableFields Array of variable fields
 * @param variableMappings Array of variable mappings
 * @param unmappedBoxIds Array of unmapped box IDs
 * @returns Object with success status and any error
 */
export const saveBoundingBoxData = (
  parsedResults: PdfResults,
  rawPdfData: string,
  file: File,
  variableFields: VariableField[] = [],
  variableMappings: any[] = [],
  unmappedBoxIds: string[] = []
): {
  success: boolean;
  error: string | null;
} => {
  if (!parsedResults || !rawPdfData || !file) {
    return {
      success: false,
      error: "Missing PDF data or bounding boxes to save"
    };
  }

  try {
    // Create unique ID for this saved PDF
    const pdfId = `pdf-${new Date().getTime()}`;
    
    // Create data object with PDF filename and bounding boxes
    const boundingBoxData = {
      id: pdfId,
      fileName: file.name,
      timestamp: new Date().toISOString(),
      data: parsedResults,
      pdfData: rawPdfData,
      // Also save variable fields and mappings if they exist
      variableFields: variableFields.length > 0 ? variableFields : undefined,
      variableMappings: variableMappings.length > 0 ? variableMappings : undefined,
      unmappedBoxIds: unmappedBoxIds.length > 0 ? unmappedBoxIds : undefined
    };

    // Convert data to JSON string
    const jsonData = JSON.stringify(boundingBoxData, null, 2);
    
    // Create a blob with the JSON data
    const blob = new Blob([jsonData], { type: 'application/json' });
    
    // Create a download link and trigger the download
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = `${file.name.replace(/\.[^/.]+$/, '')}-bounding-boxes.json`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    return {
      success: true,
      error: null
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to save data: ${err instanceof Error ? err.message : String(err)}`
    };
  }
};

/**
 * Show a file picker and load JSON bounding box data
 * @returns A Promise that resolves with the loaded data or rejects with an error
 */
export const loadBoundingBoxData = (): Promise<{
  file: File;
  objectUrl: string;
  rawPdfData: string;
  parsedResults: PdfResults;
  variableFields?: VariableField[];
  variableMappings?: any[];
  unmappedBoxIds?: string[];
}> => {
  return new Promise((resolve, reject) => {
    // Create a hidden file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';
    fileInput.style.display = 'none';
    
    // Handle file selection
    fileInput.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement;
      if (!target.files || !target.files[0]) {
        reject(new Error("No file selected"));
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          if (e.target?.result) {
            // Parse the JSON file
            const loadedData = JSON.parse(e.target.result as string);
            
            // Basic validation
            if (!loadedData.data || !loadedData.pdfData || !loadedData.fileName) {
              reject(new Error("Invalid bounding box data format"));
              return;
            }
            
            // Convert base64 back to blob
            const fileResult = createPdfFileFromBase64(loadedData.pdfData, loadedData.fileName);
            
            if (fileResult.error || !fileResult.file) {
              reject(new Error(fileResult.error || "Failed to create PDF file"));
              return;
            }
            
            resolve({
              file: fileResult.file,
              objectUrl: fileResult.objectUrl,
              rawPdfData: loadedData.pdfData,
              parsedResults: loadedData.data,
              variableFields: loadedData.variableFields,
              variableMappings: loadedData.variableMappings,
              unmappedBoxIds: loadedData.unmappedBoxIds
            });
          } else {
            reject(new Error("Failed to read file content"));
          }
        } catch (err) {
          reject(new Error(`Error loading bounding box data: ${err instanceof Error ? err.message : String(err)}`));
        }
      };
      
      reader.onerror = () => {
        reject(new Error("Error reading the file"));
      };
      
      reader.readAsText(target.files[0]);
    });
    
    // Trigger the file input click
    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
  });
};