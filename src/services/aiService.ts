import { GoogleGenAI } from "@google/genai";
import Cookies from 'js-cookie';

const apiKeyFromCookie = Cookies.get('geminiApiKey');
const genAI = new GoogleGenAI({ apiKey: apiKeyFromCookie });

interface ChatConfig {
  systemInstruction: string;
}

export const chatWithGemini = async (apiKey: string | undefined, message: string, systemInput: ChatConfig): Promise<string | null> => {
  if (!apiKey) {
    console.error('Gemini API key not found.');
    return null;
  }

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