const API_URL = "http://localhost:5008";
const uploadArea = document.getElementById("uploadArea");
const fileInput = document.getElementById("fileInput");
const loadingSpinner = document.getElementById("loadingSpinner");
const errorMessage = document.getElementById("errorMessage");
const resultContainer = document.getElementById("resultContainer");

// Click to select file
uploadArea.addEventListener("click", () => fileInput.click());

// File input change
fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    uploadFile(e.target.files[0]);
  }
});

// Drag and drop
uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.classList.add("dragover");
});

uploadArea.addEventListener("dragleave", () => {
  uploadArea.classList.remove("dragover");
});

uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("dragover");
  if (e.dataTransfer.files.length > 0) {
    uploadFile(e.dataTransfer.files[0]);
  }
});

async function uploadFile(file) {
  // Validate file type
  const allowedTypes = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
  ];
  if (!allowedTypes.includes(file.type)) {
    showError("Please upload a PDF, PNG, or JPEG file");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    uploadArea.classList.add("hidden");
    loadingSpinner.classList.remove("hidden");
    errorMessage.classList.add("hidden");
    resultContainer.classList.add("hidden");

    const response = await fetch(`${API_URL}/api/upload`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Upload failed");
    }

    displayResult(data);
  } catch (error) {
    console.error("Error:", error);
    showError(error.message);
  } finally {
    loadingSpinner.classList.add("hidden");
  }
}

function displayResult(data) {
  document.getElementById("fileName").textContent = data.fileName;
  document.getElementById("fileType").textContent = data.fileType;
  document.getElementById("recognizedText").textContent =
    data.recognizedText || "No text recognized";

  resultContainer.classList.remove("hidden");
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove("hidden");
  uploadArea.classList.remove("hidden");
}

function resetForm() {
  uploadArea.classList.remove("hidden");
  resultContainer.classList.add("hidden");
  errorMessage.classList.add("hidden");
  fileInput.value = "";
}
