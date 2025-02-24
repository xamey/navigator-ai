import { FrontendDOMState, Message } from './types';

console.log('Content script loaded');

// Function to create the extension container
function createExtensionContainer() {
    console.log('Creating extension container');

    // Check if container already exists
    let container = document.getElementById('browser-automation-extension');
    if (container) {
        console.log('Container already exists');
        container.style.display = 'block'; // Make sure it's visible
        return container;
    }

    // Create container for the extension
    container = document.createElement('div');
    container.id = 'browser-automation-extension';
    container.className = 'browser-automation-container';

    // Set styles directly on container
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.zIndex = '2147483647'; // Maximum z-index
    container.style.width = '400px';
    container.style.minWidth = '400px';
    container.style.backgroundColor = 'transparent';
    container.style.border = 'none';
    container.style.borderRadius = '8px';
    container.style.overflow = 'visible';
    container.style.boxShadow = 'none';
    container.style.transition = 'all 0.3s ease';

    // Create iframe to load the popup content
    const iframe = document.createElement('iframe');
    iframe.style.width = '400px';
    iframe.style.minWidth = '400px';
    iframe.style.height = '550px';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '8px';
    iframe.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.25)';
    iframe.style.backgroundColor = 'transparent';
    iframe.style.display = 'block';
    iframe.src = chrome.runtime.getURL('popup.html');

    // Create drag handle
    const dragHandle = document.createElement('div');
    dragHandle.style.position = 'absolute';
    dragHandle.style.top = '0';
    dragHandle.style.left = '0';
    dragHandle.style.width = '100%';
    dragHandle.style.height = '30px';
    dragHandle.style.cursor = 'move';
    dragHandle.style.zIndex = '2147483646';
    dragHandle.style.backgroundColor = 'transparent';

    // Add elements to container
    container.appendChild(iframe);
    container.appendChild(dragHandle);

    // Add container to the document body
    document.body.appendChild(container);
    console.log('Container added to document body');

    // Make draggable
    initDraggable(container, dragHandle);

    return container;
}

// Initialize draggable functionality
function initDraggable(container: HTMLElement, dragHandle: HTMLElement) {
    let isDragging = false;
    let currentX: number;
    let currentY: number;
    let initialX: number;
    let initialY: number;

    dragHandle.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e: MouseEvent) {
        console.log('Drag start');

        // Get current position relative to the viewport
        const rect = container.getBoundingClientRect();
        initialX = e.clientX - rect.left;
        initialY = e.clientY - rect.top;

        isDragging = true;
        e.preventDefault();
    }

    function drag(e: MouseEvent) {
        if (!isDragging) return;

        e.preventDefault();

        // Calculate new position
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        // Ensure the extension stays within viewport bounds
        currentX = Math.max(0, Math.min(currentX, window.innerWidth - container.offsetWidth));
        currentY = Math.max(0, Math.min(currentY, window.innerHeight - container.offsetHeight));

        // Apply the new position
        container.style.left = `${currentX}px`;
        container.style.top = `${currentY}px`;
        container.style.right = 'auto';
        container.style.bottom = 'auto';
    }

    function dragEnd() {
        if (isDragging) {
            console.log('Drag end');
            isDragging = false;

            // Save position to storage
            chrome.storage.local.set({
                extensionPosition: {
                    x: currentX,
                    y: currentY
                }
            });
        }
    }
}

// Process DOM and send data to background script
function processDOM(task_id: string): FrontendDOMState {
    try {
        console.log('Processing DOM for task:', task_id);
        const domData: FrontendDOMState = {
            url: window.location.href,
            html: document.documentElement.outerHTML,
            title: document.title,
            timestamp: new Date().toISOString()
        };

        // Send data back to background script
        chrome.runtime.sendMessage({
            type: 'dom_update',
            task_id,
            dom_data: domData,
            result: []
        });

        return domData;
    } catch (error) {
        console.error('Error processing DOM:', error);
        throw error;
    }
}

// Toggle UI visibility
function toggleUI() {
    console.log('Toggling UI');
    const container = createExtensionContainer();

    // Check current state
    const isHidden = container.style.display === 'none';

    if (isHidden) {
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }

    return !isHidden;
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    console.log('Content script received message:', message);

    if (message.type === 'processDOM' && message.task_id) {
        createExtensionContainer(); // Ensure container exists
        processDOM(message.task_id);
        if (sendResponse) sendResponse({ success: true });
    }
    else if (message.type === 'toggleUI') {
        const isVisible = toggleUI();
        if (sendResponse) sendResponse({ success: true, isVisible });
    }

    return true; // Keep channel open for async response
});

// Initialize on content script load
console.log('Creating UI container on content script load');
createExtensionContainer();