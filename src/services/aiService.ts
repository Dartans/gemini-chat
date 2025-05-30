import { GoogleGenAI } from "@google/genai";

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
      model: "gemini-2.5-pro-exp-03-25",
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