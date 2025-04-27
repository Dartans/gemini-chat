import { GoogleGenAI } from "@google/genai";
import { PdfResults, VariableField, FieldMappingResult, BoundingBox } from "../types/pdfTypes";

// Function to handle PDF processing
export const processPdfWithGemini = async (apiKey: string | undefined, fileUri: string, mimeType: string): Promise<string | null> => {
  if (!apiKey) {
    console.error('Gemini API key not found.');
    return null;
  }

  const genAI = new GoogleGenAI({ apiKey: apiKey });

  try {
    const config = {
      responseMimeType: 'application/json',
    };
    
    const contents = [
      {
        role: 'user',
        parts: [
          {
            fileData: {
              fileUri: fileUri,
              mimeType: mimeType,
            }
          },
          {
            text: `Extract only the precise fillable form sections of the document with their exact bounding boxes from each page. Follow these specific guidelines:

1. ONLY include areas that are blank and designed to be filled in (form fields)
2. NEVER include areas that already contain text or markings
3. Create tight bounding boxes that precisely fit the fillable area only - make them as accurate as possible
4. Adjust the box dimensions to exclude any surrounding text, labels, or borders
5. For checkboxes, limit boxes to the exact checkbox area only
6. For text fields, ensure the box height matches only the intended writing area
7. Ensure form fields are clearly separated from each other with appropriate spacing

Return the results as a JSON object containing a single key "pages". The value of "pages" should be an array, where each element represents a page and contains a key "boxes". The value of "boxes" should be an array of objects, each with the following keys: "page" (page number, 1-based), "x" (top-left x coordinate), "y" (top-left y coordinate), "width", "height", and "text" (description of what should be filled in this field).

Example: {"pages": [{"boxes": [{"page": 1, "x": 10, "y": 20, "width": 50, "height": 15, "text": "Full Name"}]}]}`,
          },
        ],
      },
    ];

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-pro-exp-03-25',
      contents,
      config,
    });
    
    return response.text ?? null;
  } catch (error: any) {
    console.error('Error processing PDF with Gemini API:', error);
    return null;
  }
};

// Function to map variables to bounding boxes
export const mapVariablesToBoxes = async (apiKey: string | undefined, variableNames: string[], boundingBoxes: any[]): Promise<string | null> => {
  if (!apiKey) {
    console.error('Gemini API key not found.');
    return null;
  }

  const genAI = new GoogleGenAI({ apiKey: apiKey });

  try {
    // Format the bounding box data for the prompt
    const boxData = boundingBoxes.map(box => ({
      id: box.id,
      text: box.text,
      page: box.page
    }));

    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `Map the following variable names to the most appropriate bounding boxes from the PDF form.

Variables to map:
${variableNames.map(name => `- ${name}`).join('\n')}

Bounding Box Data:
${JSON.stringify(boxData, null, 2)}

Return your response as a JSON object with the following format:
{
  "mappings": [
    { "fieldId": "variableName1", "boxId": "box-1-2" },
    { "fieldId": "variableName2", "boxId": "box-1-5" }
  ],
  "unmappedBoxes": ["box-1-3", "box-1-4"]  // IDs of boxes that don't match any variable
}

Only include mappings where you're confident there's a good match between the variable name and box content. Leave variables unmapped if there's no good match. Include any boxes that don't match variables in the unmappedBoxes array.`,
          },
        ],
      },
    ];

    const config = {
      responseMimeType: 'application/json',
    };

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-pro-exp-03-25',
      contents,
      config,
    });
    
    return response.text ?? null;
  } catch (error: any) {
    console.error('Error mapping variables with Gemini API:', error);
    return null;
  }
};

// New function to process a file with Gemini API
export const processFileWithGemini = async (
  file: File, 
  apiKey: string
): Promise<{
  rawResults: string | null;
  parsedResults: PdfResults | null;
  error: string | null;
}> => {
  if (!file || !apiKey) {
    return {
      rawResults: null,
      parsedResults: null,
      error: "Missing file or API key"
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const uploadedFile = await ai.files.upload({
      file: file,
    });

    if (!uploadedFile.uri || !uploadedFile.mimeType) {
      return {
        rawResults: null,
        parsedResults: null,
        error: "Failed to upload file or get file details."
      };
    }
    
    const result = await processPdfWithGemini(
      apiKey, 
      uploadedFile.uri, 
      uploadedFile.mimeType
    );
    
    if (!result) {
      return {
        rawResults: null,
        parsedResults: null,
        error: "No results returned from Gemini API"
      };
    }
    
    try {
      const parsedData = JSON.parse(result) as PdfResults;
      
      // Add unique ids to each bounding box
      const processedData = {
        pages: parsedData.pages.map(page => ({
          boxes: page.boxes.map((box, index) => ({
            ...box,
            id: `box-${page.boxes[0]?.page || 0}-${index}`,
          }))
        }))
      };
      
      return {
        rawResults: result,
        parsedResults: processedData,
        error: null
      };
    } catch (parseError) {
      console.error("Error parsing results:", parseError);
      return {
        rawResults: result,
        parsedResults: null,
        error: "Failed to parse results as JSON."
      };
    }
  } catch (err) {
    console.error("Error processing PDF:", err);
    return {
      rawResults: null,
      parsedResults: null,
      error: `Error processing PDF: ${err instanceof Error ? err.message : String(err)}`
    };
  }
};

// New function to map variable fields to PDF boxes using Gemini API
export const mapVariableFieldsToPdfBoxes = async (
  apiKey: string,
  variableFields: VariableField[],
  parsedResults: PdfResults
): Promise<{
  updatedFields: VariableField[];
  mappings: any[];
  unmappedBoxIds: string[];
  error: string | null;
}> => {
  if (!parsedResults || !apiKey || variableFields.length === 0) {
    return {
      updatedFields: variableFields,
      mappings: [],
      unmappedBoxIds: [],
      error: "Missing PDF data, API key, or variable fields"
    };
  }

  try {
    // Extract variable names for mapping
    const variableNames = variableFields.map(field => field.name);
    
    // Get all bounding boxes
    const allBoxes = parsedResults.pages.flatMap(page => page.boxes);
    
    // Call the AI service to map variables to boxes
    const result = await mapVariablesToBoxes(apiKey, variableNames, allBoxes);
    
    if (!result) {
      return {
        updatedFields: variableFields,
        mappings: [],
        unmappedBoxIds: [],
        error: "No mapping results returned"
      };
    }
    
    try {
      const mappingResult = JSON.parse(result) as FieldMappingResult;
      
      // Update variable fields with mapped box IDs
      const updatedFields = variableFields.map(field => {
        const mapping = mappingResult.mappings.find(m => m.fieldId === field.name);
        return mapping ? { ...field, boxId: mapping.boxId } : field;
      });
      
      // Create additional fields for unmapped boxes if needed
      const existingBoxIds = updatedFields
        .filter(field => field.boxId)
        .map(field => field.boxId as string);
      
      const newFieldsForUnmappedBoxes = mappingResult.unmappedBoxes
        .filter(boxId => !existingBoxIds.includes(boxId))
        .map(boxId => {
          const box = allBoxes.find(box => box.id === boxId);
          return {
            id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: box ? box.text.replace(/[^\w\s]/g, '').trim() : `Field ${boxId}`,
            value: '',
            boxId
          };
        });
      
      if (newFieldsForUnmappedBoxes.length > 0) {
        updatedFields.push(...newFieldsForUnmappedBoxes);
      }
      
      return {
        updatedFields,
        mappings: mappingResult.mappings,
        unmappedBoxIds: mappingResult.unmappedBoxes,
        error: null
      };
    } catch (parseError) {
      console.error("Error parsing mapping results:", parseError);
      return {
        updatedFields: variableFields,
        mappings: [],
        unmappedBoxIds: [],
        error: "Failed to parse mapping results as JSON."
      };
    }
  } catch (err) {
    console.error("Error mapping variables:", err);
    return {
      updatedFields: variableFields,
      mappings: [],
      unmappedBoxIds: [],
      error: `Error mapping variables: ${err instanceof Error ? err.message : String(err)}`
    };
  }
};

// Define interfaces to help with PDF printing
interface FilledFieldItem {
  field: VariableField;
  box: BoundingBox;
}

interface FieldsByPageJSONAccumulator {
  [key: string]: {
    field: {
      id: string;
      name: string;
      value: string | undefined;
      boxId: string | undefined;
    };
    box: {
      id: string | undefined;
      x: number;
      y: number;
      width: number;
      height: number;
      page: number;
      text: string;
    };
  }[];
}

// New function to generate and print a filled PDF with variable values
export const printFilledPdf = async (
  file: File,
  pdfUrl: string, 
  variableFields: VariableField[],
  parsedResults: PdfResults
): Promise<{
  success: boolean;
  error: string | null;
}> => {
  if (!file || !pdfUrl || !variableFields || variableFields.length === 0 || !parsedResults) {
    return {
      success: false,
      error: "Missing file or variable fields to print PDF"
    };
  }

  try {
    // Create a new window with the existing PDF URL
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      return {
        success: false,
        error: "Print window was blocked. Please allow popups and try again."
      };
    }

    // Get filled fields with their associated boxes
    const filledFields = variableFields
      .filter(field => field.value && field.boxId)
      .map(field => {
        const box = parsedResults.pages
          .flatMap(page => page.boxes)
          .find(box => box.id === field.boxId);
        
        // Return null if box is not found, filter later
        return box ? { field, box } : null;
      })
      .filter((item): item is FilledFieldItem => item !== null && item.box !== undefined);

    // Group fields by page
    const fieldsByPage: Record<number, FilledFieldItem[]> = {};
    filledFields.forEach(item => {
      const pageNum = item.box.page;
      if (!fieldsByPage[pageNum]) {
        fieldsByPage[pageNum] = [];
      }
      fieldsByPage[pageNum].push(item);
    });
    
    // Stringify fieldsByPage in a safer way for HTML insertion
    const fieldsByPageJSON = JSON.stringify(
      Object.entries(fieldsByPage).reduce((acc: FieldsByPageJSONAccumulator, [pageNum, items]: [string, FilledFieldItem[]]) => {
        acc[pageNum] = items.map(item => ({
          field: {
            id: item.field.id,
            name: item.field.name,
            value: item.field.value,
            boxId: item.field.boxId
          },
          box: {
            id: item.box.id,
            x: item.box.x, 
            y: item.box.y,
            width: item.box.width,
            height: item.box.height,
            page: item.box.page,
            text: item.box.text
          }
        }));
        return acc;
      }, {} as FieldsByPageJSONAccumulator)
    );

    // Write HTML content to the new window
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print PDF - ${file.name}</title>
        <style>
          body, html {
            margin: 0;
            padding: 0;
            height: 100%;
            overflow: auto;
          }
          #pdf-container {
            position: relative;
            margin: 0 auto;
          }
          .page-container {
            position: relative;
            margin-bottom: 20px;
            page-break-after: always;
            box-shadow: 0 0 5px rgba(0, 0, 0, 0.2);
          }
          .page-container:last-child {
            page-break-after: auto;
          }
          .form-field {
            position: absolute;
            background-color: white;
            color: black;
            border: none;
            font-family: Arial, sans-serif;
            padding: 0px 2px;
            margin: 0;
            overflow: hidden;
            display: flex;
            align-items: center;
            text-align: left;
            line-height: 1.2;
          }
          @media print {
            body {
              background-color: white;
            }
            .controls {
              display: none;
            }
            .page-container {
              margin: 0;
              page-break-after: always;
              box-shadow: none;
            }
          }
          .controls {
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 10px;
            background-color: white;
            border: 1px solid #ccc;
            border-radius: 5px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            z-index: 1000;
          }
          .print-button {
            background-color: #4caf50;
            color: white;
            border: none;
            padding: 8px 16px;
            font-size: 16px;
            cursor: pointer;
            border-radius: 4px;
          }
        </style>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js"></script>
      </head>
      <body>
        <div class="controls">
          <button class="print-button" onclick="window.print(); setTimeout(() => window.close(), 500);">
            Print
          </button>
        </div>
        <div id="pdf-container"></div>
        
        <script>
          // Set up PDF.js worker
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

          // Fields by page from the React app
          const fieldsByPage = ${fieldsByPageJSON};
          
          async function renderPdf() {
            try {
              // Load the PDF document
              const loadingTask = pdfjsLib.getDocument('${pdfUrl}');
              const pdf = await loadingTask.promise;
              
              const container = document.getElementById('pdf-container');
              const totalPages = pdf.numPages;
              
              // Render each page of the PDF
              for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1.5 }); // Adjust scale for better print quality
                
                // Create page container
                const pageContainer = document.createElement('div');
                pageContainer.className = 'page-container';
                pageContainer.style.width = viewport.width + 'px';
                pageContainer.style.height = viewport.height + 'px';
                container.appendChild(pageContainer);
                
                // Create canvas for the PDF page
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                pageContainer.appendChild(canvas);
                
                // Render PDF page to canvas
                const renderContext = {
                  canvasContext: canvas.getContext('2d'),
                  viewport: viewport
                };
                
                await page.render(renderContext).promise;
                
                // Add form fields for this page if any exist
                if (fieldsByPage[pageNum]) {
                  fieldsByPage[pageNum].forEach(item => {
                    const { field, box } = item;
                    
                    // Create field element
                    const fieldElement = document.createElement('div');
                    fieldElement.className = 'form-field';
                    
                    // Convert normalized coordinates (0-1000) to actual page coordinates
                    const x = (box.x / 1000) * viewport.width;
                    const y = (box.y / 1000) * viewport.height;
                    const width = (box.width / 1000) * viewport.width;
                    const height = (box.height / 1000) * viewport.height;
                    
                    // Position and size the field
                    fieldElement.style.left = x + 'px';
                    fieldElement.style.top = y + 'px';
                    fieldElement.style.width = width + 'px';
                    fieldElement.style.height = height + 'px';
                    
                    // Set text size based on height (similar to the way it's shown in preview)
                    fieldElement.style.fontSize = Math.min(height * 0.7, 14) + 'px';
                    
                    // Set the field value
                    fieldElement.textContent = field.value;
                    
                    // Add the field to the page
                    pageContainer.appendChild(fieldElement);
                  });
                }
              }
              
              // Show success message
              console.log('PDF prepared for printing');
            } catch (error) {
              console.error('Error rendering PDF:', error);
              document.body.innerHTML += '<p>Error rendering PDF: ' + error.message + '</p>';
            }
          }
          
          // Start rendering when the page has loaded
          window.onload = renderPdf;
        </script>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    
    return {
      success: true,
      error: null
    };
  } catch (err) {
    console.error("Error printing PDF:", err);
    return {
      success: false,
      error: `Failed to print PDF: ${err instanceof Error ? err.message : String(err)}`
    };
  }
};

