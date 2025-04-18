import { GoogleGenAI } from "@google/genai";
import Cookies from 'js-cookie';

interface ChatConfig {
  systemInstruction: string;
}

export const chatWithGemini = async (apiKey: string | undefined, message: string, systemInput: ChatConfig): Promise<string | null> => {
  if (!apiKey) {
    console.error('Gemini API key not found.');
    return null;
  }

  const genAI = new GoogleGenAI({ apiKey: apiKey });

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: message,
      config: {
        systemInstruction: systemInput.systemInstruction,
      },
    });
    console.log(response);
    return response.text ?? null;

  } catch (error: any) {
    console.error('Error calling Gemini API:', error);
    return null;
  }
};

// New function to handle PDF processing
export const processPdfWithGemini = async (apiKey: string | undefined, fileUri: string, mimeType: string): Promise<string | null> => {
  if (!apiKey) {
    console.error('Gemini API key not found.');
    return null;
  }

  const genAI = new GoogleGenAI({ apiKey: apiKey });

  try {
    // Use the correct method generateContent instead of getGenerativeModel
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
            // Updated prompt for structured JSON output
            text: `Extract fillable sections of the document with their bounding boxes from each page keeping the bounding boxes within the fillable area and not overlaying any existing text. Return the results as a JSON object containing a single key "pages". The value of "pages" should be an array, where each element represents a page and contains a key "boxes". The value of "boxes" should be an array of objects, each with the following keys: "page" (page number, 1-based), "x" (top-left x coordinate), "y" (top-left y coordinate), "width", "height", and "text". Example: {"pages": [{"boxes": [{"page": 1, "x": 10, "y": 20, "width": 50, "height": 15, "text": "Example"}]}]}`,
          },
        ],
      },
    ];

    const response = await genAI.models.generateContent({
      // Change model to the suggested experimental version
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