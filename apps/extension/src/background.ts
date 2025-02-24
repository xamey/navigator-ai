import { Message } from './types';

const API_BASE_URL = 'http://localhost:8000';

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    try {
        if (message.type === 'startTask') {
            // Create task on the server
            fetch(`${API_BASE_URL}/tasks/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ task: message.task }),
            })
                .then(response => response.json())
                .then(data => {
                    const task_id = data.task_id;

                    // Inject content script into active tab
                    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                        if (tabs[0]?.id) {
                            try {
                                await chrome.scripting.executeScript({
                                    target: { tabId: tabs[0].id },
                                    files: ['content.js']
                                });

                                // Send message to content script
                                chrome.tabs.sendMessage(tabs[0].id, {
                                    type: 'processDOM',
                                    task_id
                                });
                            } catch (error) {
                                console.error('Error injecting content script:', error);
                            }
                        }
                    });

                    // Send response back to popup
                    sendResponse({ task_id });
                })
                .catch(error => {
                    console.error('Error creating task:', error);
                    sendResponse({ error: 'Failed to create task' });
                });
        } else if (message.type === 'dom_update') {
            // Send DOM update to server
            fetch(`${API_BASE_URL}/tasks/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    task_id: message.task_id,
                    dom_data: message.dom_data,
                    result: message.result || []
                }),
            })
                .then(() => console.log('DOM update sent to server'))
                .catch(error => console.error('Error sending DOM update:', error));
        }
    } catch (error) {
        console.error('Error in background script:', error);
        sendResponse({ error: 'Background script error' });
    }
    return true;
}); 