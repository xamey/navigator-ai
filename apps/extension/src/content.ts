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
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            background-color: transparent !important;
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
    let currentX: number;
    let currentY: number;
    let initialX: number;
    let initialY: number;

    dragHandle.addEventListener('mousedown', dragStart, { passive: false });

    function dragStart(e: MouseEvent) {
        // Stop event propagation so the page doesn't receive this event
        e.stopPropagation();
        e.preventDefault();

        console.log('Drag start');

        // Get current position relative to the viewport
        const rect = container.getBoundingClientRect();
        initialX = e.clientX - rect.left;
        initialY = e.clientY - rect.top;

        isDragging = true;

        document.addEventListener('mousemove', drag, { passive: false });
        document.addEventListener('mouseup', dragEnd, { passive: false });
    }

    function drag(e: MouseEvent) {
        if (!isDragging) return;

        // Stop event propagation to prevent page interaction issues
        e.stopPropagation();
        e.preventDefault();

        // Calculate new position
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        // Constrain to viewport
        const maxX = window.innerWidth - container.offsetWidth;
        const maxY = window.innerHeight - container.offsetHeight;

        currentX = Math.max(0, Math.min(currentX, maxX));
        currentY = Math.max(0, Math.min(currentY, maxY));

        // Apply new position
        container.style.left = `${currentX}px`;
        container.style.top = `${currentY}px`;
        container.style.right = 'auto';
        container.style.bottom = 'auto';
    }

    function dragEnd(e: MouseEvent) {
        // Stop event propagation
        e.stopPropagation();

        initialX = currentX;
        initialY = currentY;
        isDragging = false;

        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', dragEnd);
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