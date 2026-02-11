# Image Recognition App

A basic full-stack application for uploading PDFs and images with optical character recognition (OCR) capability.

## Features

- 📤 Upload PDF, PNG, and JPEG files
- 🔍 Automatic text recognition using Tesseract.js
- 📜 PDF text extraction
- 🎨 Clean, modern UI with drag-and-drop support
- ⚡ Fast processing and real-time results

## Project Structure

```
image-recognition/
├── backend/
│   ├── server.js          # Express API server
│   ├── package.json       # Backend dependencies
│   └── .env              # Environment variables
├── frontend/
│   ├── index.html        # Main HTML file
│   ├── style.css         # Styling
│   └── app.js            # Frontend JavaScript
└── README.md
```

## Tech Stack

### Backend
- **Express.js** - REST API framework
- **Multer** - File upload handling
- **Tesseract.js** - OCR for image processing
- **pdf-parse** - PDF text extraction
- **CORS** - Cross-origin resource sharing

### Frontend
- **Vanilla HTML/CSS/JavaScript** - No build tools required
- **Fetch API** - Backend communication

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
# Development mode (with hot reload)
npm run dev

# Or production mode
npm start
```

The server will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Start a local server (Python):
```bash
# Python 3
python3 -m http.server 8000

# Or Python 2
python -m SimpleHTTPServer 8000
```

Or use any other static server (VS Code Live Server extension, `npx http-server`, etc.)

3. Open your browser and go to `http://localhost:8000`

## Usage

1. Open the frontend in your browser
2. Click the upload area or drag and drop a file (PDF, PNG, JPEG)
3. Wait for the processing to complete
4. View the recognized text results

## API Endpoints

### POST `/api/upload`
Upload a file for text recognition

curl -s -X POST http://localhost:5008/api/upload -F
      "file=@/Users/christiannogueras/Documents/Work/Akcelita/Uwe/Ideas/image-recognition/backend/sample/lumaBill.pdf" |
      python3 -m json.tool

**Request:**
- Method: `POST`
- Body: `multipart/form-data` with `file` field
- Accepted file types: PDF, PNG, JPEG

**Response:**
```json
{
  "success": true,
  "fileName": "document.pdf",
  "fileType": "application/pdf",
  "recognizedText": "Extracted text from the document...",
  "confidence": "OCR processing complete"
}
```

### GET `/health`
Health check endpoint

**Response:**
```json
{
  "status": "Server is running"
}
```

## Troubleshooting

### CORS Errors
Ensure the backend is running on `http://localhost:5000` and the frontend is accessing it correctly.

### Tesseract.js Slow
First-time OCR processing downloads language models (~50MB). This is cached for subsequent uses.

### File Not Processing
- Check that the file is PDF, PNG, or JPEG
- Ensure the file size is reasonable (< 50MB recommended)
- Check browser console for error messages

## Future Enhancements

- [ ] Support for multiple languages
- [ ] Batch file processing
- [ ] Image preview before processing
- [ ] Text copy-to-clipboard functionality
- [ ] Processing history
- [ ] Database integration for storing results
- [ ] Advanced image processing (rotation, filtering)
- [ ] Docker containerization

## License

MIT
