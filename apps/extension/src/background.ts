/* eslint-disable @typescript-eslint/no-explicit-any */
import { DOMUpdate, Message } from './types';

console.log('Background script initializing...');

const API_BASE_URL = 'http://localhost:8000';
let monitoringInterval: NodeJS.Timeout | null = null;
const MAX_ITERATIONS = 1;
let currentIterations = 0;
let isPaused = false;

// Store active task session
let activeSession: {
    taskId: string;
    status: 'active' | 'completed' | 'error' | 'paused';
    isPaused?: boolean;
    isRunning?: boolean;
} | null = null;

// Initialize session from storage on extension load
chrome.storage.local.get(['activeSession'], (result) => {
    console.log('Loaded active session from storage:', result.activeSession);
    if (result.activeSession) {
        activeSession = result.activeSession;
        isPaused = result.activeSession.isPaused || false;
    }
});

// Helper function to check if a URL is accessible by content scripts
function isValidUrl(url: string): boolean {
    return typeof url === 'string' &&
        !url.startsWith('chrome://') &&
        !url.startsWith('chrome-extension://') &&
        !url.startsWith('chrome-search://') &&
        !url.startsWith('about:') &&
        !url.startsWith('edge://') &&
        !url.startsWith('brave://');
}

// Handle extension icon click - toggle sidebar
chrome.action.onClicked.addListener((tab) => {
    console.log('Extension icon clicked, toggling sidebar in tab:', tab.id);
    if (tab.id && tab.url && isValidUrl(tab.url)) {
        chrome.tabs.sendMessage(tab.id, { type: 'toggleSidebar' })
            .catch(err => {
                console.error('Error sending toggleSidebar message:', err);
                // Try injecting content script if it's not loaded
                chrome.scripting.executeScript({
                    target: { tabId: tab.id! },
                    files: ['content.js']
                })
                    .then(() => {
                        // Now try sending the message again
                        chrome.tabs.sendMessage(tab.id!, { type: 'toggleSidebar' });
                    })
                    .catch(injectErr => {
                        console.error('Failed to inject content script:', injectErr);
                    });
            });
    } else {
        console.log('Cannot toggle sidebar on this page (likely a chrome:// URL)');
    }
});

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
    console.log('Background received message:', message.type, sender?.tab?.id);

    try {
        if (message.type === 'startTask') {
            handleStartTask(message, sendResponse);
            return true; // Keep channel open for async response
        } else if (message.type === 'startMonitoring') {
            startMonitoring(message.task_id!);
            sendResponse({ success: true });
        } else if (message.type === 'stopMonitoring') {
            stopMonitoring();
            sendResponse({ success: true });
        } else if (message.type === 'dom_update') {
            handleDOMUpdate(message);
            sendResponse({ success: true });
        } else if (message.type === 'toggleSidebar') {
            // Find the active tab and send toggle message
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs.length > 0 && tabs[0].id && tabs[0].url && isValidUrl(tabs[0].url)) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: 'toggleSidebar' })
                        .then(() => {
                            sendResponse({ success: true });
                        })
                        .catch(err => {
                            console.error('Error sending toggleSidebar:', err);
                            sendResponse({ success: false, error: err.message });
                        });
                } else {
                    console.log('Cannot toggle sidebar on this page (likely a chrome:// URL)');
                    sendResponse({ success: false, error: 'Cannot toggle sidebar on this page' });
                }
            });
            return true; // Keep channel open for async response
        } else if (message.type === 'pauseMonitoring') {
            pauseMonitoring();
            sendResponse({ success: true });
        } else if (message.type === 'resumeMonitoring') {
            resumeMonitoring();
            sendResponse({ success: true });
        }
    } catch (error) {
        console.error('Error in background script:', error);
        sendResponse({ success: false, error: 'Background script error' });
    }

    return true; // Keep channel open for async response
});

async function handleDOMUpdate(message: Message) {
    try {
        if (!message.task_id || !message.dom_data) {
            console.error('Missing required fields in DOM update');
            return;
        }

        console.log('Received pre-processed DOM data for task:', message.task_id);

        // The DOM structure is already parsed by the content script
        const updateData: DOMUpdate = {
            task_id: message.task_id,
            dom_data: message.dom_data,
            result: Array.isArray(message.result) ? message.result : [],
            iterations: currentIterations,
            structure: message.dom_data.structure ?? {}
        };

        console.log('Sending DOM update to API:', updateData.task_id);
        const response = await fetch(`${API_BASE_URL}/tasks/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Server error ${response.status}: ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        console.log('DOM update successful:', data);
    } catch (error) {
        console.error('Error in handleDOMUpdate:', error);
        // Optionally update active session status on error
        if (activeSession) {
            activeSession.status = 'error';
            await chrome.storage.local.set({ activeSession });
        }
    }
}

async function handleStartTask(message: Message, sendResponse: (response?: any) => void) {
    try {
        console.log('Starting task:', message.task);

        // If there's an active session, use that task ID
        if (activeSession?.taskId && activeSession.status === 'active') {
            console.log('Using existing active session:', activeSession.taskId);
            sendResponse({ task_id: activeSession.taskId });
            return;
        }

        // Otherwise create a new task
        console.log('Creating new task with server');
        const response = await fetch(`${API_BASE_URL}/tasks/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ task: message.task }),
        });

        const data = await response.json();
        console.log('Task created successfully:', data.task_id);

        // Store the new session
        activeSession = {
            taskId: data.task_id,
            status: 'active',
            isPaused: false
        };

        // Persist session
        await chrome.storage.local.set({ activeSession });

        sendResponse({ task_id: data.task_id });
    } catch (error) {
        console.error('Error creating task:', error);
        sendResponse({ error: 'Failed to create task' });
    }
}

function startMonitoring(task_id: string) {
    console.log('Starting monitoring for task:', task_id);

    if (monitoringInterval) {
        clearInterval(monitoringInterval);
    }

    currentIterations = 0;
    isPaused = false;

    monitoringInterval = setInterval(async () => {
        if (isPaused) {
            console.log('Monitoring is paused, skipping iteration');
            return;
        }

        if (currentIterations >= MAX_ITERATIONS) {
            console.log('Reached max iterations, stopping monitoring');
            stopMonitoring();
            if (activeSession) {
                activeSession.status = 'completed';
                await chrome.storage.local.set({ activeSession });

                // Also update taskState to ensure popup display is correct
                const taskState = await chrome.storage.local.get(['taskState']);
                if (taskState.taskState) {
                    await chrome.storage.local.set({
                        taskState: {
                            ...taskState.taskState,
                            status: 'completed',
                            isRunning: false
                        }
                    });
                }

                chrome.runtime.sendMessage({
                    type: 'stopMonitoring',
                    task_id
                });
            }
            return;
        }

        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id && tabs[0]?.url && isValidUrl(tabs[0].url)) {
            try {
                console.log('Processing DOM for iteration:', currentIterations + 1);

                // Try sending message directly first, only inject if needed
                try {
                    // Send message to process DOM
                    await chrome.tabs.sendMessage(tabs[0].id, {
                        type: 'processDOM',
                        task_id
                    });
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                } catch (msgError) {
                    // Content script not loaded yet, inject it first
                    console.log('Content script not loaded, injecting it...');
                    await chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        files: ['content.js']
                    });

                    // Now send the message
                    await chrome.tabs.sendMessage(tabs[0].id, {
                        type: 'processDOM',
                        task_id
                    });
                }

                currentIterations++;
                chrome.runtime.sendMessage({
                    type: 'iterationUpdate',
                    iterations: currentIterations
                });
                // Update popup with current iterations
                const taskState = await chrome.storage.local.get(['taskState']);
                if (taskState.taskState) {
                    await chrome.storage.local.set({
                        taskState: {
                            ...taskState.taskState,
                            iterations: currentIterations
                        }
                    });
                }
            } catch (error) {
                console.error('Error in monitoring loop:', error);
                if (activeSession) {
                    activeSession.status = 'error';
                    await chrome.storage.local.set({ activeSession });
                }
            }
        } else {
            console.log('Cannot process DOM on this page (likely a chrome:// URL). Skipping this iteration.');
        }
    }, 2000);
}

function stopMonitoring() {
    console.log('Stopping monitoring');
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
}

function pauseMonitoring() {
    console.log('Pausing automation monitoring');
    isPaused = true;

    if (activeSession) {
        activeSession.isPaused = true;
        chrome.storage.local.set({ activeSession });
    }

    chrome.runtime.sendMessage({
        type: 'pauseStateChanged',
        isPaused: true
    });
}

function resumeMonitoring() {
    console.log('Resuming automation monitoring');
    isPaused = false;

    if (activeSession) {
        activeSession.isPaused = false;
        chrome.storage.local.set({ activeSession });
    }

    chrome.runtime.sendMessage({
        type: 'pauseStateChanged',
        isPaused: false
    });
}