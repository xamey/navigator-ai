import { DOMElementNode, DOMHashMap, DOMNode, parseDOMonServer } from '@navigator-ai/core';
import { FrontendDOMState, Message } from './types';

console.log('Content script loaded');

let sidebarContainer: HTMLElement | null = null;

// Function to create the extension container as a sidebar
function createSidebarContainer() {
    console.log('Creating sidebar container');

    // Check if container already exists
    let container = document.getElementById('navigator-ai-sidebar');
    if (container) {
        console.log('Sidebar container already exists');
        return container;
    }

    // Create container for the sidebar
    container = document.createElement('div');
    container.id = 'navigator-ai-sidebar';

    // Set essential properties
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.right = '0';
    container.style.width = '0'; // Start with zero width
    container.style.height = '100%';
    container.style.zIndex = '9999999';
    container.style.transition = 'width 0.3s ease';
    container.style.overflow = 'hidden';

    // Create a shadow root to isolate our CSS
    const shadow = container.attachShadow({ mode: 'closed' });

    // Create styles for shadow DOM
    const style = document.createElement('style');
    style.textContent = `
        :host {
            color-scheme: light dark;
        }
        
        iframe {
            width: 100%;
            height: 100%;
            border: none;
            background-color: transparent !important;
        }
        
        .sidebar-open {
            width: 384px !important; /* 96 * 4 = 384px for w-96 in Tailwind */
        }
        
        .sidebar-closed {
            width: 0 !important;
        }
    `;

    // Create iframe to hold the sidebar content
    const iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('popup.html');
    iframe.style.backgroundColor = 'transparent';
    iframe.style.opacity = '0.98';
    iframe.allow = 'autoplay';

    // Add elements to shadow DOM
    shadow.appendChild(style);
    shadow.appendChild(iframe);

    // Add container to document body
    document.body.appendChild(container);

    // Store for later use
    sidebarContainer = container;

    return container;
}

// Function to update sidebar visibility state
function updateSidebarState(isOpen: boolean) {
    console.log('Updating sidebar state:', isOpen);

    if (!sidebarContainer) {
        sidebarContainer = createSidebarContainer();
    }

    if (isOpen) {
        sidebarContainer.style.width = '384px'; // w-96 in Tailwind
        sidebarContainer.classList.add('sidebar-open');
        sidebarContainer.classList.remove('sidebar-closed');
    } else {
        sidebarContainer.style.width = '0';
        sidebarContainer.classList.add('sidebar-closed');
        sidebarContainer.classList.remove('sidebar-open');
    }
}

// Toggle sidebar visibility
function toggleSidebar() {
    console.log('Toggling sidebar');

    if (!sidebarContainer) {
        sidebarContainer = createSidebarContainer();
    }

    const isCurrentlyOpen = sidebarContainer.classList.contains('sidebar-open');
    updateSidebarState(!isCurrentlyOpen);

    return !isCurrentlyOpen;
}

// Process DOM and send data to background script
async function processDOM(task_id: string): Promise<FrontendDOMState> {
    try {
        console.log('Processing DOM for task:', task_id);

        // Get the HTML content
        const htmlContent = document.documentElement.outerHTML;

        // Parse the DOM on the server instead of locally
        console.log('Sending HTML to server for parsing...');
        const domStructure = await parseDOMonServer(htmlContent);
        console.log('Received parsed DOM structure from server');

        const domData: FrontendDOMState = {
            url: window.location.href,
            html: htmlContent,
            title: document.title,
            timestamp: new Date().toISOString(),
            structure: domStructure
        };

        console.log('Highlighting interactive elements');
        highlightInteractiveElements(domStructure);

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

function highlightInteractiveElements(domStructure: DOMHashMap) {
    // Clear previous highlights first
    clearAllHighlights();

    const interactiveElements = Object.values(domStructure).filter((node) => {
        if (!node.isVisible) {
            return false;
        }
        if (!('type' in node)) {
            const element = node as DOMElementNode;
            return element.isInteractive;
        }
        return false;
    });

    // highlight interactive elements by adding style and color to the dom by accessing element using xpath
    interactiveElements.forEach((element: DOMNode, index: number) => {
        const xpath = (element as DOMElementNode).xpath;
        try {
            const highlightedElement = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement;
            if (highlightedElement && highlightedElement instanceof HTMLElement) {
                highlightedElement.style.outline = `2px solid ${colors[index % colors.length]}`;
                highlightedElement.style.outlineOffset = '2px';
                highlightedElement.classList.add('navigator-ai-highlight');
            }
        } catch (error) {
            console.error('Error highlighting element:', error);
        }
    });
}

// Function to clear all highlights
function clearAllHighlights() {
    const highlightedElements = document.querySelectorAll('.navigator-ai-highlight');
    highlightedElements.forEach((el) => {
        if (el instanceof HTMLElement) {
            el.style.outline = '';
            el.style.outlineOffset = '';
            el.classList.remove('navigator-ai-highlight');
        }
    });
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    console.log('Content script received message:', message);

    try {
        if (message.type === 'processDOM' && message.task_id) {
            createSidebarContainer(); // Ensure container exists
            processDOM(message.task_id)
                .then(() => {
                    if (sendResponse) sendResponse({ success: true });
                })
                .catch(error => {
                    console.error('Error in processDOM:', error);
                    if (sendResponse) sendResponse({ success: false, error: error.message });
                });
            return true; // Keep channel open for async response
        }
        else if (message.type === 'toggleUI' || message.type === 'toggleSidebar') {
            const isVisible = toggleSidebar();
            if (sendResponse) sendResponse({ success: true, isVisible });
        }
        else if (message.type === 'updateSidebarState') {
            updateSidebarState(message.isOpen || false);
            if (sendResponse) sendResponse({ success: true });
        }
    } catch (error) {
        console.error('Error handling message:', error);
        if (sendResponse) sendResponse({ success: false, error: (error as Error).message });
    }

    return true; // Keep channel open for async response
});

// Initialize on content script load
console.log('Creating sidebar container on content script load');
createSidebarContainer();

const colors = [
    "#FF0000", "#00FF00", "#0000FF", "#FFA500",
    "#800080", "#008080", "#FF69B4", "#4B0082",
    "#FF4500", "#2E8B57", "#DC143C", "#4682B4",
];