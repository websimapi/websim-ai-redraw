import html2canvas from 'html2canvas';

// Drawing Canvas Setup
let canvas, ctx;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentTool = 'pencil';
let currentColor = '#000000';
let currentSize = 5;

// DOM Elements
const pencilBtn = document.getElementById('pencil');
const eraserBtn = document.getElementById('eraser');
const clearBtn = document.getElementById('clear');
const colorPicker = document.getElementById('colorPicker');
const brushSize = document.getElementById('brushSize');
const sizeValue = document.getElementById('sizeValue');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');
const analysisResult = document.getElementById('analysisResult');
const generatedImage = document.getElementById('generatedImage');

// Initialize Canvas
function initCanvas() {
    canvas = document.getElementById('drawingCanvas');
    ctx = canvas.getContext('2d');
    
    // Set canvas dimensions to match container
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Set initial canvas state
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = currentSize;
    ctx.strokeStyle = currentColor;
    
    // Canvas Event Listeners
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // Touch Events
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', stopDrawing);
    
    // Clear canvas initially
    clearCanvas();
}

function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    // Reset the context settings after resize
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = currentSize;
    ctx.strokeStyle = currentColor;
}

function startDrawing(e) {
    isDrawing = true;
    [lastX, lastY] = getCoordinates(e);
}

function draw(e) {
    if (!isDrawing) return;
    
    // Prevent scrolling when drawing on touch devices
    e.preventDefault();
    
    const [currentX, currentY] = getCoordinates(e);
    
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();
    
    [lastX, lastY] = [currentX, currentY];
}

function stopDrawing() {
    isDrawing = false;
}

function getCoordinates(e) {
    let x, y;
    
    if (e.type.includes('touch')) {
        const touch = e.touches[0] || e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        x = touch.clientX - rect.left;
        y = touch.clientY - rect.top;
    } else {
        x = e.offsetX;
        y = e.offsetY;
    }
    
    return [x, y];
}

function handleTouchStart(e) {
    e.preventDefault();
    startDrawing(e);
}

function handleTouchMove(e) {
    e.preventDefault();
    draw(e);
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Tool Functions
function selectTool(tool) {
    currentTool = tool;
    
    // Reset tool button states
    [pencilBtn, eraserBtn].forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Update tool state
    if (tool === 'pencil') {
        pencilBtn.classList.add('active');
        ctx.strokeStyle = currentColor;
        ctx.globalCompositeOperation = 'source-over';
    } else if (tool === 'eraser') {
        eraserBtn.classList.add('active');
        ctx.globalCompositeOperation = 'destination-out';
    }
}

function updateBrushSize(size) {
    currentSize = size;
    sizeValue.textContent = size;
    ctx.lineWidth = size;
}

function updateColor(color) {
    currentColor = color;
    if (currentTool === 'pencil') {
        ctx.strokeStyle = color;
    }
}

// Tab Functions
function switchTab(tabId) {
    tabBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active');
        }
    });
    
    tabPanes.forEach(pane => {
        pane.classList.remove('active');
        if (pane.id === tabId) {
            pane.classList.add('active');
        }
    });
}

// Canvas to Data URL
async function getCanvasImage() {
    return new Promise((resolve) => {
        // Use html2canvas to capture the canvas
        html2canvas(canvas).then(capturedCanvas => {
            resolve(capturedCanvas.toDataURL('image/png'));
        });
    });
}

// Analyze and Transform Functions
async function analyzeAndTransform() {
    try {
        // Show loading state
        analyzeBtn.style.display = 'none';
        loadingSpinner.style.display = 'block';
        
        // Get canvas image
        const imageDataUrl = await getCanvasImage();
        
        // Step 1: Analyze the image with AI
        const imageDescription = await analyzeImage(imageDataUrl);
        
        // Step 2: Generate a new image based on the description
        const generatedImageUrl = await generateImage(imageDescription);
        
        // Update UI with results
        displayResults(imageDescription, generatedImageUrl);
        
        // Switch to description tab
        switchTab('description');
        
    } catch (error) {
        console.error('Error in analyze and transform process:', error);
        alert('Something went wrong. Please try again.');
    } finally {
        // Hide loading state
        analyzeBtn.style.display = 'block';
        loadingSpinner.style.display = 'none';
    }
}

async function analyzeImage(imageDataUrl) {
    try {
        const completion = await websim.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are an expert art analyst. Your task is to provide a detailed description of the drawing submitted by the user. Focus on content, colors, style, shapes, and composition. Be precise, detailed and descriptive, as your description will be used to regenerate this image in HD quality."
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Analyze this drawing and provide a detailed description that could be used to recreate it as a high-quality image. Focus on subject matter, colors, style, and composition."
                        },
                        {
                            type: "image_url",
                            image_url: { url: imageDataUrl }
                        }
                    ]
                }
            ]
        });
        
        return completion.content;
    } catch (error) {
        console.error('Error analyzing image:', error);
        throw new Error('Failed to analyze the image');
    }
}

async function generateImage(description) {
    try {
        const result = await websim.imageGen({
            prompt: `Create a high-definition, detailed image based on this description: ${description}`,
            aspect_ratio: "1:1"
        });
        
        return result.url;
    } catch (error) {
        console.error('Error generating image:', error);
        throw new Error('Failed to generate the image');
    }
}

function displayResults(description, imageUrl) {
    // Update description tab
    analysisResult.innerHTML = `<div class="description-content">${description}</div>`;
    
    // Update image tab
    generatedImage.innerHTML = `<img src="${imageUrl}" alt="AI generated image">`;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    
    // Tool Event Listeners
    pencilBtn.addEventListener('click', () => selectTool('pencil'));
    eraserBtn.addEventListener('click', () => selectTool('eraser'));
    clearBtn.addEventListener('click', clearCanvas);
    
    // Color and Size Event Listeners
    colorPicker.addEventListener('input', (e) => updateColor(e.target.value));
    brushSize.addEventListener('input', (e) => updateBrushSize(e.target.value));
    
    // Tab Event Listeners
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // Analyze Button Event Listener
    analyzeBtn.addEventListener('click', analyzeAndTransform);
});

