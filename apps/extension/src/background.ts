/* eslint-disable @typescript-eslint/no-explicit-any */
import { DOMUpdate, Message } from './types';

const API_BASE_URL = 'http://localhost:8000';
let monitoringInterval: NodeJS.Timeout | null = null;
const MAX_ITERATIONS = 3;
let currentIterations = 0;

// Store active task session
let activeSession: {
    taskId: string;
    status: 'active' | 'completed' | 'error';
} | null = null;

// Initialize session from storage on extension load
chrome.storage.local.get(['activeSession'], (result) => {
    if (result.activeSession) {
        activeSession = result.activeSession;
    }
});

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    try {
        if (message.type === 'startTask') {
            handleStartTask(message, sendResponse);
        } else if (message.type === 'startMonitoring') {
            startMonitoring(message.task_id!);
        } else if (message.type === 'stopMonitoring') {
            stopMonitoring();
        } else if (message.type === 'dom_update') {
            handleDOMUpdate(message);
        }
    } catch (error) {
        console.error('Error in background script:', error);
        sendResponse({ error: 'Background script error' });
    }
    return true;
});

async function handleDOMUpdate(message: Message) {
    if (!message.task_id || !message.dom_data) {
        console.error('Missing required fields in DOM update');
        return;
    }

    const updateData: DOMUpdate = {
        task_id: message.task_id,
        dom_data: message.dom_data,
        result: Array.isArray(message.result) ? message.result : []  // Ensure result is always an array
    };

    try {
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
        console.error('Error sending DOM update:', error);
        // Optionally update active session status on error
        if (activeSession) {
            activeSession.status = 'error';
            await chrome.storage.local.set({ activeSession });
        }
    }
}

async function handleStartTask(message: Message, sendResponse: (response?: any) => void) {
    try {
        // If there's an active session, use that task ID
        if (activeSession?.taskId && activeSession.status === 'active') {
            sendResponse({ task_id: activeSession.taskId });
            return;
        }

        // Otherwise create a new task
        const response = await fetch(`${API_BASE_URL}/tasks/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ task: message.task }),
        });

        const data = await response.json();

        // Store the new session
        activeSession = {
            taskId: data.task_id,
            status: 'active'
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
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
    }

    currentIterations = 0;
    monitoringInterval = setInterval(async () => {
        if (currentIterations >= MAX_ITERATIONS) {
            stopMonitoring();
            if (activeSession) {
                activeSession.status = 'completed';
                await chrome.storage.local.set({ activeSession });
            }
            return;
        }

        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    files: ['content.js']
                });

                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'processDOM',
                    task_id
                });

                currentIterations++;

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
        }
    }, 2000);
}

function stopMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
} 