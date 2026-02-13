const fs = require('fs');
const { GoogleGenAI, Type } = require('@google/genai');
const { EXTRACTION_PROMPT } = require('../prompt');

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
  name: 'Gemini 2.5 Flash',
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
      model: 'gemini-2.5-flash',
      contents: [filePart, EXTRACTION_PROMPT],
      config: {
        responseMimeType: 'application/json',
        responseSchema,
      },
    });

    const parsed = JSON.parse(response.text);
    const usage = response.usageMetadata
      ? { inputTokens: response.usageMetadata.promptTokenCount || 0, outputTokens: response.usageMetadata.candidatesTokenCount || 0 }
      : null;
    return { ...parsed, usage };
  },
};
