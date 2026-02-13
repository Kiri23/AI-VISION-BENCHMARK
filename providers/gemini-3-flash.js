const fs = require('fs');
const { GoogleGenAI, Type } = require('@google/genai');
const { EXTRACTION_PROMPT } = require('../prompts/gemini3FlashPrompt');

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    months: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          month: { type: Type.STRING },
          kwh: { type: Type.NUMBER },
          costPerKwh: { type: Type.NUMBER },
        },
        required: ['month', 'kwh', 'costPerKwh'],
      },
    },
    chartComplete: { type: Type.BOOLEAN },
  },
  required: ['months', 'chartComplete'],
};

module.exports = {
  name: 'Gemini 3 Flash (Preview)',
  async extract(filePath, mimeType) {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const fileBuffer = fs.readFileSync(filePath);

    const filePart = {
      inlineData: {
        data: fileBuffer.toString('base64'),
        mimeType,
      },
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [filePart, EXTRACTION_PROMPT],
      config: {
        responseMimeType: 'application/json',
        responseSchema,
        tools: [{ codeExecution: {} }],
      },
    });

    // With code execution enabled, response.text may not return clean JSON.
    // Try response.text first, then fall back to extracting from parts.
    let parsed;
    try {
      parsed = JSON.parse(response.text);
    } catch {
      const parts = response.candidates?.[0]?.content?.parts || [];
      const textPart = parts.filter(p => p.text).map(p => p.text).join('');
      parsed = JSON.parse(textPart);
    }

    const usage = response.usageMetadata
      ? { inputTokens: response.usageMetadata.promptTokenCount || 0, outputTokens: response.usageMetadata.candidatesTokenCount || 0 }
      : null;
    return { ...parsed, usage };
  },
};
