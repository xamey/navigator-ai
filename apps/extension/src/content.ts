import { FrontendDOMState, Message } from './types';

function processDOM(task_id: string): FrontendDOMState {
    try {
        const domData: FrontendDOMState = {
            url: window.location.href,
            // Get the complete HTML content
            html: document.documentElement.outerHTML,
            // Additional metadata about the page
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

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message: Message) => {
    if (message.type === 'processDOM' && message.task_id) {
        processDOM(message.task_id);
    }
}); 