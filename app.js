import html2canvas from 'html2canvas';

// Drawing Canvas Setup
let canvas, ctx;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentTool = 'pencil';
let currentColor = '#000000';
let currentSize = 5;

// WebSocket and Multiplayer
let room;

// Current transformation data
let currentDrawingData = {
    originalImage: null,
    generatedImage: null,
    description: ''
};

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
const galleryContainer = document.getElementById('galleryContainer');
const galleryBadge = document.getElementById('galleryBadge');
const imageUpload = document.getElementById('imageUpload');
const imageModal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const modalClose = document.getElementById('modalClose');

// AI Settings Elements
const styleSelect = document.getElementById('styleSelect');
const aspectRatioSelect = document.getElementById('aspectRatioSelect');
const customInstructions = document.getElementById('customInstructions');

// Initialize WebSocket connection
function initializeWebSocket() {
    room = new WebsimSocket();

    // Subscribe to peer updates
    room.party.subscribe((peers) => {
        console.log('Connected peers:', peers);
    });

    // Handle disconnections and reconnections
    room.onmessage = (event) => {
        const data = event.data;
        if (data.type === 'connected') {
            console.log(`Client connected: ${data.clientId}, ${data.username}`);
        } else if (data.type === 'disconnected') {
            console.log(`Client disconnected: ${data.clientId}, ${data.username}`);
        }
    };

    // Subscribe to gallery updates
    loadGalleryItems();
}

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
    
    // File upload event listener
    imageUpload.addEventListener('change', handleImageUpload);
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

// Load an image into the canvas
async function loadImageToCanvas(src, isRemote = false) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            // Clear canvas
            clearCanvas();
            
            // Calculate scaling to fit canvas while maintaining aspect ratio
            const canvasRatio = canvas.width / canvas.height;
            const imgRatio = img.width / img.height;
            
            let drawWidth, drawHeight, offsetX, offsetY;
            
            if (imgRatio > canvasRatio) {
                // Image is wider than canvas proportionally
                drawWidth = canvas.width;
                drawHeight = canvas.width / imgRatio;
                offsetX = 0;
                offsetY = (canvas.height - drawHeight) / 2;
            } else {
                // Image is taller than canvas proportionally
                drawHeight = canvas.height;
                drawWidth = canvas.height * imgRatio;
                offsetX = (canvas.width - drawWidth) / 2;
                offsetY = 0;
            }
            
            ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
            resolve();
        };
        
        img.onerror = () => {
            reject(new Error('Failed to load image'));
        };
        
        if (isRemote) {
            // Set crossOrigin before setting the src
            img.crossOrigin = 'anonymous';
            // Use a reliable CORS proxy
            img.src = `https://corsproxy.io/?${encodeURIComponent(src)}`;
        } else {
            img.src = src;
        }
    });
}

// Handle image upload
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            await loadImageToCanvas(event.target.result);
        } catch (error) {
            console.error('Error loading image:', error);
            alert('Failed to load the image. Please try again.');
        }
    };
    reader.readAsDataURL(file);
    
    // Reset the input to allow selecting the same file again
    imageUpload.value = '';
}

// Gallery Functions
async function saveToGallery(originalImg, generatedImg, description) {
    try {
        // Create a record in the 'redraw' collection
        await room.collection('redraw').create({
            originalImage: originalImg,
            generatedImage: generatedImg,
            description: description,
            style: styleSelect.value,
            customInstructions: customInstructions.value
        });
        
        // Update the gallery badge
        const currentCount = parseInt(galleryBadge.textContent || '0');
        galleryBadge.textContent = currentCount + 1;
        galleryBadge.style.display = 'flex';
        
        console.log('Saved to gallery successfully');
    } catch (error) {
        console.error('Error saving to gallery:', error);
        alert('Failed to save to gallery. Please try again.');
    }
}

async function loadGalleryItems() {
    // Subscribe to gallery updates
    room.collection('redraw').subscribe((items) => {
        renderGalleryItems(items);
        
        // Update badge if there are new items
        if (items.length > 0) {
            const currentTab = document.querySelector('.tab-btn.active').dataset.tab;
            if (currentTab !== 'gallery') {
                galleryBadge.textContent = items.length;
                galleryBadge.style.display = 'flex';
            } else {
                galleryBadge.style.display = 'none';
            }
        }
    });
}

function renderGalleryItems(items) {
    if (items.length === 0) {
        galleryContainer.innerHTML = `
            <div class="empty-gallery">
                <p>No images in the gallery yet. Create your first transformation!</p>
            </div>
        `;
        return;
    }
    
    galleryContainer.innerHTML = '';
    
    // Sort items by creation date (newest first)
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    items.forEach(item => {
        const galleryItem = document.createElement('div');
        galleryItem.className = 'gallery-item';
        
        const truncatedDescription = item.description.length > 150 
            ? item.description.substring(0, 150) + '...' 
            : item.description;
        
        galleryItem.innerHTML = `
            <div class="gallery-images">
                <div class="gallery-original">
                    <img src="${item.originalImage}" alt="Original drawing" data-fullsize="${item.originalImage}">
                </div>
                <div class="gallery-generated">
                    <img src="${item.generatedImage}" alt="AI generated image" data-fullsize="${item.generatedImage}">
                </div>
            </div>
            <div class="gallery-info">
                <div class="username-display">
                    <img class="avatar" src="https://images.websim.ai/avatar/${item.username}" alt="User avatar">
                    <div class="gallery-username">${item.username}</div>
                </div>
                <div class="gallery-description">${truncatedDescription}</div>
            </div>
            <div class="gallery-actions">
                <button class="load-original" data-src="${item.originalImage}">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                    </svg>
                    Load Original
                </button>
                <button class="load-generated" data-src="${item.generatedImage}">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                    </svg>
                    Load Generated
                </button>
            </div>
        `;
        
        // Add event listeners for the gallery item
        const originalImg = galleryItem.querySelector('.gallery-original img');
        const generatedImg = galleryItem.querySelector('.gallery-generated img');
        const loadOriginalBtn = galleryItem.querySelector('.load-original');
        const loadGeneratedBtn = galleryItem.querySelector('.load-generated');
        
        originalImg.addEventListener('click', () => showImageModal(item.originalImage));
        generatedImg.addEventListener('click', () => showImageModal(item.generatedImage));
        
        loadOriginalBtn.addEventListener('click', async () => {
            try {
                switchTab('draw'); // Switch to drawing tab
                await loadImageToCanvas(item.originalImage);
            } catch (error) {
                console.error('Error loading image:', error);
                alert('Failed to load the image. Please try again.');
            }
        });
        
        loadGeneratedBtn.addEventListener('click', async () => {
            try {
                switchTab('draw'); // Switch to drawing tab
                await loadImageToCanvas(item.generatedImage, true);
            } catch (error) {
                console.error('Error loading image:', error);
                alert('Failed to load the image. Please try again.');
            }
        });
        
        galleryContainer.appendChild(galleryItem);
    });
}

// Modal Functions
function showImageModal(src) {
    modalImage.src = src;
    imageModal.classList.add('show');
}

function hideImageModal() {
    imageModal.classList.remove('show');
    setTimeout(() => {
        modalImage.src = '';
    }, 300);
}

// Analyze and Transform Functions
async function analyzeAndTransform() {
    try {
        // Show loading state
        analyzeBtn.style.display = 'none';
        loadingSpinner.style.display = 'block';
        
        // Get canvas image
        const imageDataUrl = await getCanvasImage();
        currentDrawingData.originalImage = imageDataUrl;
        
        // Step 1: Analyze the image with AI
        const imageDescription = await analyzeImage(imageDataUrl);
        currentDrawingData.description = imageDescription;
        
        // Step 2: Generate a new image based on the description and settings
        const generatedImageUrl = await generateImage(imageDescription);
        currentDrawingData.generatedImage = generatedImageUrl;
        
        // Step 3: Save to gallery
        await saveToGallery(imageDataUrl, generatedImageUrl, imageDescription);
        
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
        // Prepare the prompt based on settings
        let prompt = `Create a high-definition, detailed image based on this description: ${description}`;
        
        // Add style if selected
        if (styleSelect.value) {
            prompt += `. Render in ${styleSelect.value} style`;
        }
        
        // Add custom instructions if provided
        if (customInstructions.value.trim()) {
            prompt += `. ${customInstructions.value.trim()}`;
        }
        
        const result = await websim.imageGen({
            prompt: prompt,
            aspect_ratio: aspectRatioSelect.value
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
    generatedImage.innerHTML = `
        <img src="${imageUrl}" alt="AI generated image" onclick="showImageModal('${imageUrl}')">
        <button class="load-button" id="loadGenerated">Load into Canvas</button>
    `;
    
    // Add event listener to load button
    document.getElementById('loadGenerated').addEventListener('click', async () => {
        try {
            switchTab('draw'); // Switch to drawing tab
            await loadImageToCanvas(imageUrl, true);
        } catch (error) {
            console.error('Error loading generated image:', error);
            alert('Failed to load the generated image. Please try again.');
        }
    });
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
    
    // Hide badge when gallery tab is active
    if (tabId === 'gallery') {
        galleryBadge.style.display = 'none';
    }
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

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    initializeWebSocket();
    
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
    
    // Modal Event Listeners
    modalClose.addEventListener('click', hideImageModal);
    imageModal.addEventListener('click', (e) => {
        if (e.target === imageModal) {
            hideImageModal();
        }
    });
    
    // Set default aspect ratio
    aspectRatioSelect.value = '1:1';
});