const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI, Type } = require('@google/genai');
const { EXTRACTION_PROMPT } = require('./test/prompt');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Gemini client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPEG, and PDF files are allowed'), false);
    }
  }
});

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);

    const filePart = {
      inlineData: {
        data: fileBuffer.toString('base64'),
        mimeType: req.file.mimetype,
      }
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [filePart, EXTRACTION_PROMPT],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
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
          },
          required: ['months'],
        },
      },
    });

    const data = JSON.parse(response.text);

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({ success: true, data });

  } catch (error) {
    console.error('Error processing file:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to process file', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
