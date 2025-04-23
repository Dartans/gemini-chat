import { GoogleGenAI } from "@google/genai";

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