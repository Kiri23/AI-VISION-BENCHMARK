const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { EXTRACTION_PROMPT } = require('../prompt');

const responseSchema = {
  type: 'object',
  properties: {
    months: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          month: { type: 'string' },
          kwh: { type: 'number' },
          costPerKwh: { type: 'number' },
        },
        required: ['month', 'kwh', 'costPerKwh'],
        additionalProperties: false,
      },
    },
  },
  required: ['months'],
  additionalProperties: false,
};

module.exports = {
  name: 'OpenAI GPT-4o',
  async extract(filePath, mimeType) {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString('base64');

    const fileContent = mimeType === 'application/pdf'
      ? { type: 'file', file: { file_data: `data:application/pdf;base64,${base64}`, filename: path.basename(filePath) } }
      : { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } };

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: EXTRACTION_PROMPT },
            fileContent,
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'luma_extraction',
          strict: true,
          schema: responseSchema,
        },
      },
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    const usage = response.usage
      ? { inputTokens: response.usage.prompt_tokens || 0, outputTokens: response.usage.completion_tokens || 0 }
      : null;
    return { ...parsed, usage };
  },
};
