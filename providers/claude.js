const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
const { EXTRACTION_PROMPT } = require('../prompt');

module.exports = {
  name: 'Claude Sonnet 4.5',
  async extract(filePath, mimeType) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString('base64');

    const mediaType = mimeType === 'application/pdf' ? 'application/pdf' : mimeType;
    const contentType = mimeType === 'application/pdf' ? 'document' : 'image';

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: contentType,
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            { type: 'text', text: EXTRACTION_PROMPT + '\n\nRespond with ONLY a JSON object (no markdown, no code fences) using this exact schema:\n{"months":[{"month":"string","kwh":number,"costPerKwh":number}]}' },
          ],
        },
      ],
    });

    let text = response.content[0].text;
    // Strip markdown code fences if present
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(text);
  },
};
