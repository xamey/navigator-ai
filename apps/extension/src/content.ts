import { DOMElementNode, DOMHashMap, DOMNode, parseDOMonServer, Action, AutomationHandler } from '@navigator-ai/core';
import { FrontendDOMState, Message, ProcessingStatus } from './types';

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

async function processDOM(task_id: string): Promise<FrontendDOMState> {
    try {
        console.log('Processing DOM for task:', task_id);

        const htmlContent = document.documentElement.outerHTML;

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

        // Send data to background script and wait for complete response including any actions
        return new Promise<FrontendDOMState>((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'dom_update',
                task_id,
                dom_data: domData,
                result: []
            }, async response => {
                console.log('Background script response from DOM update:', response);
                
                if (response && response.data) {
                    // Check if there are actions to execute and wait for them to complete
                    if (response.data.result?.actions && response.data.result.actions.length > 0) {
                        console.log('Waiting for actions to complete...');
                        try {
                            // Wait for actions from the update response to complete
                            // before resolving the processDOM promise
                            const actionResults = await handleAutomationActions(response.data.result.actions);
                            console.log('Action execution results:', actionResults);
                            
                            // Only resolve after actions are complete
                            resolve(domData);
                        } catch (actionError) {
                            console.error('Error executing actions:', actionError);
                            reject(new Error('Failed to execute actions: ' + (actionError as Error).message));
                        }
                    } else {
                        // No actions to execute, resolve immediately
                        resolve(domData);
                    }
                } else if (response && response.success) {
                    resolve(domData);
                } else {
                    reject(new Error('Failed to update DOM: ' + (response?.error || 'Unknown error')));
                }
            });
        });
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

// Initialize automation handler
const automationHandler = new AutomationHandler();

// New function to process DOM sequentially
async function sequentialDOMProcessing(task_id: string, maxIterations = 10) {
    // Always start with 0 iterations when workflow starts
    let iteration = 0;
    let isDone = false;
    
    console.log('Starting sequential DOM processing for task:', task_id);
    
    // Notify background script to reset iteration counter
    await new Promise<void>((resolve) => {
        chrome.runtime.sendMessage({
            type: 'resetIterations',
            task_id
        }, () => {
            resolve();
        });
    });
    
    while (!isDone && iteration < maxIterations) {
        console.log(`Starting iteration ${iteration + 1} of DOM processing`);
        
        try {
            // Step 1: Parse and update DOM, which now also waits for any actions to complete
            // This ensures the entire process is sequential
            await processDOM(task_id);
            
            // Increment iteration counter after processing is complete
            iteration++;
            
            // Step 2: Check if processing is done
            // After actions have completed, check if the task is marked as done
            isDone = await checkIfProcessingDone(task_id);
            
            console.log(`Iteration ${iteration} complete. isDone:`, isDone);
            
            // Add a small delay between iterations to avoid overwhelming the system
            if (!isDone && iteration < maxIterations) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (error) {
            console.error(`Error in iteration ${iteration + 1}:`, error);
            break;
        }
    }
    
    console.log(`Sequential DOM processing complete after ${iteration} iterations`);
    return { success: true, iterations: iteration, isDone };
}

// Function to check if processing is done
function checkIfProcessingDone(task_id: string): Promise<boolean> {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({
            type: 'check_processing_status',
            task_id
        }, response => {
            console.log('Processing status check response:', response);
            
            // Check if the response has the isDone property
            if (response && typeof response.isDone === 'boolean') {
                resolve(response.isDone);
            } else {
                // If the server didn't explicitly say it's done, check active session status
                chrome.storage.local.get(['activeSession'], (result) => {
                    const isDone = result.activeSession?.status === 'completed';
                    console.log('Checking active session status for completion:', isDone);
                    resolve(isDone);
                });
            }
        });
    });
}

// Helper function to wait for a specific processing status
async function waitForProcessingStatus(task_id: string, targetStatus: ProcessingStatus, timeoutMs = 60000): Promise<boolean> {
    const startTime = Date.now();
    
    return new Promise<boolean>((resolve) => {
        // Set a timeout to avoid hanging forever
        const timeoutId = setTimeout(() => {
            console.warn(`Waiting for status ${targetStatus} timed out after ${timeoutMs}ms`);
            resolve(false);
        }, timeoutMs);
        
        // Check status periodically
        const checkStatus = async () => {
            const result = await chrome.storage.local.get(['taskState']);
            const currentStatus = result.taskState?.processingStatus;
            
            console.log(`Current processing status: ${currentStatus}, waiting for: ${targetStatus}`);
            
            if (currentStatus === targetStatus) {
                clearTimeout(timeoutId);
                resolve(true);
                return;
            }
            
            // If error status, stop waiting
            if (currentStatus === 'error') {
                clearTimeout(timeoutId);
                console.error('Processing status shows error, stopping wait');
                resolve(false);
                return;
            }
            
            // Check again after a delay
            setTimeout(checkStatus, 500);
        };
        
        // Start checking
        checkStatus();
    });
}

// Helper to get the latest server update from storage
async function getLatestUpdateResult(task_id: string): Promise<any> {
    const result = await chrome.storage.local.get(['currentDOMUpdate', 'lastUpdateResponse']);
    
    if (result.currentDOMUpdate?.task_id === task_id && result.currentDOMUpdate?.status === 'completed') {
        return {
            success: true,
            data: result.currentDOMUpdate.result
        };
    } else if (result.lastUpdateResponse?.task_id === task_id) {
        return {
            success: true,
            data: result.lastUpdateResponse.data
        };
    }
    
    return {
        success: false,
        error: 'No update result found'
    };
}

// New function for reliable single DOM process iteration using storage for state management
async function singleDOMProcessIteration(task_id: string): Promise<{ 
    success: boolean; 
    error?: string;
    isDone?: boolean;
}> {
    try {
        console.log('Starting single DOM process iteration for task:', task_id);
        
        // Step 1: Get HTML and parse DOM
        const htmlContent = document.documentElement.outerHTML;
        console.log('Sending HTML to server for parsing...');
        
        // Parse DOM data
        const domStructure = await parseDOMonServer(htmlContent);
        console.log('Received parsed DOM structure from server');
        
        // Create DOM data object
        const domData: FrontendDOMState = {
            url: window.location.href,
            html: htmlContent,
            title: document.title,
            timestamp: new Date().toISOString(),
            structure: domStructure
        };
        
        // Apply highlight to interactive elements
        console.log('Highlighting interactive elements');
        highlightInteractiveElements(domStructure);
        
        // Step 2: Start DOM update but don't wait for message response
        console.log('Sending DOM update to server via background script');
        
        // Just trigger the DOM update, don't wait for direct response 
        chrome.runtime.sendMessage({
            type: 'dom_update',
            task_id,
            dom_data: domData,
            result: []
        });
        
        // Instead of relying on message response, wait for the processing status to change
        console.log('Waiting for DOM update to complete...');
        const waitForStatus = await waitForProcessingStatus(task_id, 'completed', 120000);
        
        if (!waitForStatus) {
            // If completion never happened, check if there's an error status
            const taskState = await chrome.storage.local.get(['taskState']);
            if (taskState.taskState?.processingStatus === 'error') {
                return { success: false, error: 'DOM update failed with error' };
            }
            
            return { success: false, error: 'DOM update timed out waiting for completion' };
        }
        
        // Get the update result from storage
        const updateResult = await getLatestUpdateResult(task_id);
        
        if (!updateResult.success) {
            console.error('Failed to get update result:', updateResult.error);
            return { success: false, error: updateResult.error };
        }
        
        console.log('DOM update successful:', updateResult);
        
        // Step 3: Handle any actions returned from the server
        if (updateResult.data?.result?.actions?.length > 0) {
            console.log('Executing actions from update response');
            const actions = updateResult.data.result.actions;
            
            try {
                // Mark status as executing actions
                await chrome.runtime.sendMessage({
                    type: 'updateProcessingStatus',
                    task_id,
                    status: 'executing_actions'
                });
                
                const actionResults = await handleAutomationActions(actions);
                console.log('Action execution results:', actionResults);
                
                // Mark status as completed after actions are done
                await chrome.runtime.sendMessage({
                    type: 'updateProcessingStatus',
                    task_id,
                    status: 'completed'
                });
            } catch (actionError) {
                console.error('Error executing actions:', actionError);
                
                // Mark status as error if actions failed
                await chrome.runtime.sendMessage({
                    type: 'updateProcessingStatus',
                    task_id,
                    status: 'error'
                });
                
                return { 
                    success: false, 
                    error: actionError instanceof Error ? actionError.message : String(actionError)
                };
            }
        } else {
            // Explicitly mark as completed if no actions needed
            await chrome.runtime.sendMessage({
                type: 'updateProcessingStatus',
                task_id,
                status: 'completed'
            });
        }
        
        // Step 4: Check if task is done
        const isDone = !!updateResult.data?.result?.is_done;
        console.log('Is this iteration the final one?', isDone);
        
        return { 
            success: true,
            isDone
        };
    } catch (error) {
        console.error('Error in single DOM process iteration:', error);
        return { 
            success: false, 
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

// Handle messages from background script
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
    console.log('Content script received message:', message.type);

    // Simple ping to check if content script is loaded
    if (message.type === 'ping') {
        sendResponse({ success: true });
        return true;
    }
    
    // Process a single DOM iteration fully (parse + update + actions)
    if (message.type === 'singleDOMProcess' && message.task_id) {
        createSidebarContainer(); // Ensure container exists
        
        // This processes a single iteration completely and reliably
        singleDOMProcessIteration(message.task_id)
            .then((result) => {
                console.log('Single DOM process complete:', result);
                sendResponse(result);
            })
            .catch(error => {
                console.error('Error in singleDOMProcess:', error);
                sendResponse({ 
                    success: false, 
                    error: error instanceof Error ? error.message : String(error) 
                });
            });
        
        return true; // Keep channel open for async response
    }

    if (message.type === 'executeActions' && Array.isArray(message.actions)) {
        handleAutomationActions(message.actions)
            .then(results => {
                sendResponse({ success: true, results });
            })
            .catch(error => {
                console.error('Error executing actions:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Keep channel open for async response
    }

    if (message.type === 'processDOM' && message.task_id) {
        createSidebarContainer(); // Ensure container exists
        processDOM(message.task_id)
            .then((domData) => {
                sendResponse({ success: true, domData });
            })
            .catch(error => {
                console.error('Error in processDOM:', error);
                sendResponse({ 
                    success: false, 
                    error: error instanceof Error ? error.message : String(error) 
                });
            });
        return true; // Keep channel open for async response
    }
    else if (message.type === 'startSequentialProcessing' && message.task_id) {
        createSidebarContainer(); // Ensure container exists
        sequentialDOMProcessing(message.task_id, message.maxIterations || 10)
            .then((result) => {
                sendResponse({ success: true, result });
            })
            .catch(error => {
                console.error('Error in sequential processing:', error);
                sendResponse({ 
                    success: false, 
                    error: error instanceof Error ? error.message : String(error)
                });
            });
        return true; // Keep channel open for async response
    }
    else if (message.type === 'toggleUI' || message.type === 'toggleSidebar') {
        const isVisible = toggleSidebar();
        sendResponse({ success: true, isVisible });
        return true;
    }
    else if (message.type === 'updateSidebarState') {
        updateSidebarState(message.isOpen || false);
        sendResponse({ success: true });
        return true;
    }

    // If we reach here, it was an unknown message type
    return false;
});

async function handleAutomationActions(actions: Action[]) {
    console.log('Executing automation actions:', actions);
    return await automationHandler.executeActions(actions);
}

// Initialize on content script load
console.log('Creating sidebar container on content script load');
createSidebarContainer();

const colors = [
    "#FF0000", "#00FF00", "#0000FF", "#FFA500",
    "#800080", "#008080", "#FF69B4", "#4B0082",
    "#FF4500", "#2E8B57", "#DC143C", "#4682B4",
];