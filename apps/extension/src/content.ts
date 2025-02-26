import { parseDOM } from '@navigator-ai/core';
import { FrontendDOMState, Message } from './types';

console.log('Content script loaded');

// Function to create the extension container
function createExtensionContainer() {
    console.log('Creating extension container');

    // Check if container already exists
    let container = document.getElementById('browser-automation-extension');
    if (container) {
        console.log('Container already exists');
        container.style.display = 'block';
        return container;
    }

    // Create container for the extension
    container = document.createElement('div');
    container.id = 'browser-automation-extension';

    // Only set these essential properties directly on the container
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999999'; // Still high but not maximum
    container.style.pointerEvents = 'none'; // Important! Allow clicks to pass through
    container.style.transition = 'all 0.3s ease';

    // Create a shadow root - this isolates our CSS
    const shadow = container.attachShadow({ mode: 'closed' });

    // Create a wrapper inside the shadow DOM that will catch pointer events
    const wrapper = document.createElement('div');
    wrapper.className = 'extension-wrapper';
    wrapper.style.pointerEvents = 'auto';
    wrapper.style.position = 'relative';

    // Create styles for shadow DOM
    const style = document.createElement('style');
    style.textContent = `
        .extension-wrapper {
            width: 400px;
            height: auto;
            max-height: 550px;
            background-color: transparent !important;
        }
        iframe {
            width: 100%;
            height: 550px;
            border: none;
            border-radius: 8px;
            box-shadow: none !important;
            background-color: transparent !important;
            color-scheme: gjfdk fjskl;
            opacity: 0.98;
        }
        .drag-handle {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 30px;
            cursor: move;
            z-index: 1;
        }
    `;

    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('popup.html');
    iframe.style.backgroundColor = 'transparent';
    iframe.style.backdropFilter = 'none';
    // iframe.style.webkitBackdropFilter = 'none';
    iframe.style.opacity = '0.98';
    iframe.allow = 'autoplay';

    // Create drag handle
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';

    // Add elements to shadow DOM
    shadow.appendChild(style);
    shadow.appendChild(wrapper);
    wrapper.appendChild(iframe);
    wrapper.appendChild(dragHandle);

    // Add container to document body
    document.body.appendChild(container);

    // Make draggable
    initDraggable(container, dragHandle);

    return container;
}

// Initialize draggable functionality
function initDraggable(container: HTMLElement, dragHandle: HTMLElement) {
    let isDragging = false;
    let initialX: number;
    let initialY: number;
    let startPositionX: number;
    let startPositionY: number;

    // Store position in local storage
    function savePosition(x: number, y: number) {
        localStorage.setItem('popupPosition', JSON.stringify({ left: x, top: y }));
    }

    function loadPosition() {
        try {
            const position = localStorage.getItem('popupPosition');
            if (position) {
                const { left, top } = JSON.parse(position);
                container.style.left = left + 'px';
                container.style.top = top + 'px';
                container.style.right = 'auto';
                container.style.bottom = 'auto';
            }
        } catch (e) {
            console.error('Error loading position:', e);
        }
    }

    // Set initial position from storage or default
    loadPosition();

    // Handle mousedown event to start drag
    dragHandle.addEventListener('mousedown', (e) => {
        // Only handle left mouse button
        if (e.button !== 0) return;

        // Check if the element has the drag-handle class
        // This ensures dragging only works when minimized
        if (!dragHandle.classList.contains('drag-handle')) return;

        e.preventDefault();
        e.stopPropagation();

        // Get current container position
        const style = window.getComputedStyle(container);
        startPositionX = parseInt(style.left, 10) || 0;
        startPositionY = parseInt(style.top, 10) || 0;

        // Calculate offset from mouse to container corner
        initialX = e.clientX - startPositionX;
        initialY = e.clientY - startPositionY;

        isDragging = true;
        container.classList.add('dragging');

        // Add document-wide event listeners
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('mouseleave', onMouseUp);
    });

    function onMouseMove(e: MouseEvent) {
        if (!isDragging) return;

        e.preventDefault();
        e.stopPropagation();

        // Calculate new position
        const x = e.clientX - initialX;
        const y = e.clientY - initialY;

        // Constrain to viewport
        const maxX = window.innerWidth - container.offsetWidth;
        const maxY = window.innerHeight - container.offsetHeight;
        const newX = Math.max(0, Math.min(x, maxX));
        const newY = Math.max(0, Math.min(y, maxY));

        // Set the new position directly
        container.style.left = `${newX}px`;
        container.style.top = `${newY}px`;
        container.style.right = 'auto';
        container.style.bottom = 'auto';
    }

    function onMouseUp(e: MouseEvent) {
        if (!isDragging) return;

        e.preventDefault();
        e.stopPropagation();

        isDragging = false;
        container.classList.remove('dragging');

        // Save the final position
        const style = window.getComputedStyle(container);
        const finalX = parseInt(style.left, 10);
        const finalY = parseInt(style.top, 10);
        savePosition(finalX, finalY);

        // Clean up event listeners
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('mouseleave', onMouseUp);
    }
}

// Process DOM and send data to background script
function processDOM(task_id: string): FrontendDOMState {
    try {
        console.log('Processing DOM for task:', task_id);

        // Parse the DOM here in the content script where we have full access
        const domStructure = parseDOM(document);

        const domData: FrontendDOMState = {
            url: window.location.href,
            html: document.documentElement.outerHTML,
            title: document.title,
            timestamp: new Date().toISOString(),
            // Instead of sending the DOM object, send the already parsed structure
            structure: domStructure
        };

        console.log('Sending DOM update to background, structure size:',
            JSON.stringify(domData.structure).length, 'bytes');

        // Send data back to background script
        chrome.runtime.sendMessage({
            type: 'dom_update',
            task_id,
            dom_data: domData,
            result: []
        }, response => {
            console.log('Background script response:', response);
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