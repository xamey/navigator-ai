import { FrontendDOMState, Message } from './types';

function processDOM(task_id: string): FrontendDOMState {
    try {
        const domData: FrontendDOMState = {
            url: window.location.href
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

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    try {
        if (message.type === 'processDOM' && message.task_id) {
            const domData = processDOM(message.task_id);
            console.log('DOM processed:', domData);
            sendResponse({ success: true });
        }
    } catch (error) {
        console.error('Error in content script:', error);
        sendResponse({ error: 'Content script error' });
    }
    return true;
}); 