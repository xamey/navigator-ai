import { parseDOMonServer } from '@navigator-ai/core';
import { FrontendDOMState, ProcessingStatus } from '../types';
import { captureIframeContents } from './iframe';
import { highlightInteractiveElements } from '../highlight';
import { handleAutomationActions } from '../automation';

export async function processDOM(task_id: string): Promise<FrontendDOMState> {
    try {
        console.log('Processing DOM for task:', task_id);

        const htmlContent = document.documentElement.outerHTML;
        
        const processedHtml = await captureIframeContents(htmlContent);

        console.log('Sending HTML with iframe contents to server for parsing...');
        const domStructure = await parseDOMonServer(processedHtml);
        console.log('Received parsed DOM structure from server');

        const domData: FrontendDOMState = {
            url: window.location.href,
            html: processedHtml,
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

/**
 * Process DOM sequentially with multiple iterations
 * @param task_id The task ID
 * @param maxIterations Maximum number of iterations
 * @returns Promise with the result of the processing
 */
export async function sequentialDOMProcessing(task_id: string, maxIterations = 10) {
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

/**
 * Perform a single iteration of DOM processing
 * @param task_id The task ID
 * @returns Promise with the result of the processing
 */
export async function singleDOMProcessIteration(task_id: string): Promise<{ 
    success: boolean; 
    error?: string;
    isDone?: boolean;
}> {
    try {
        console.log('Starting single DOM process iteration for task:', task_id);
        
        const currentUrl = window.location.href;
        const domainCheckResult = await checkDomainChange(currentUrl, task_id);
        
        if (domainCheckResult.domainChanged) {
            console.log('Domain has changed, terminating workflow');
            return { 
                success: false, 
                error: 'Domain changed, workflow terminated',
                isDone: true 
            };
        }
        
        // Capture main document HTML
        const htmlContent = document.documentElement.outerHTML;
        
        // Add a marker for iframe content that we'll replace with actual iframe content
        const processedHtml = await captureIframeContents(htmlContent);
        
        console.log('Sending HTML with iframe contents to server for parsing...');
        
        const domStructure = await parseDOMonServer(processedHtml);
        console.log('Received parsed DOM structure from server');
        
        const domData: FrontendDOMState = {
            url: window.location.href,
            html: processedHtml,
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
        
        // Check if backend signaled to complete
        const isDone = !!updateResult.data?.result?.is_done;
        
        // If is_done is set to true, update activeSession in storage directly
        if (isDone) {
            console.log('Server indicated workflow is complete (is_done=true)');
            await chrome.storage.local.get(['activeSession'], async (result) => {
                if (result.activeSession) {
                    await chrome.storage.local.set({
                        activeSession: {
                            ...result.activeSession,
                            status: 'completed'
                        }
                    });
                    console.log('Updated activeSession.status to completed');
                }
            });
        }
        
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

/**
 * Check if domain has changed
 * @param currentUrl Current URL
 * @param task_id Task ID
 * @returns Promise with domain change check result
 */
export async function checkDomainChange(currentUrl: string, task_id: string): Promise<{domainChanged: boolean}> {
    return new Promise((resolve) => {
        try {
            // Use a timeout to prevent hanging if no response is received
            const timeoutId = setTimeout(() => {
                console.warn('Domain change check timed out, assuming no change');
                resolve({ domainChanged: false });
            }, 2000);
            
            chrome.runtime.sendMessage({
                type: 'checkDomainChange',
                currentUrl,
                task_id
            }, (response) => {
                clearTimeout(timeoutId);
                
                if (chrome.runtime.lastError) {
                    console.error('Error checking domain change:', chrome.runtime.lastError);
                    // Default to false if there's an error
                    resolve({ domainChanged: false });
                } else {
                    resolve({ domainChanged: !!response?.domainChanged });
                }
            });
        } catch (error) {
            console.error('Exception during domain change check:', error);
            resolve({ domainChanged: false });
        }
    });
}

/**
 * Check if processing is complete
 * @param task_id The task ID
 * @returns Promise with boolean indicating if processing is done
 */
export function checkIfProcessingDone(task_id: string): Promise<boolean> {
    return new Promise((resolve) => {
        // First check local storage directly for the most up-to-date state
        chrome.storage.local.get(['activeSession', 'taskState', 'lastUpdateResponse'], (result) => {
            // Check multiple sources for workflow completion
            
            // 1. Check active session status
            const sessionDone = result.activeSession?.status === 'completed';
            
            // 2. Check if last update response had is_done flag
            const lastUpdateDone = result.lastUpdateResponse?.data?.result?.is_done === true;
            
            // 3. Check task state processing status
            const processingDone = result.taskState?.processingStatus === 'completed';
            
            console.log('Completion check:', { 
                sessionDone, 
                lastUpdateDone, 
                processingDone
            });
            
            // If ANY of these indicate completion, consider the workflow done
            const isDone = sessionDone || lastUpdateDone || processingDone;
            
            if (isDone) {
                console.log('Workflow completion detected, marking as done');
                resolve(true);
                return;
            }
            
            // If not found in storage, try message-based check as backup
            chrome.runtime.sendMessage({
                type: 'check_processing_status',
                task_id
            }, response => {
                console.log('Processing status check response:', response);
                
                // Check if the response has the isDone property
                if (response && typeof response.isDone === 'boolean') {
                    resolve(response.isDone);
                } else {
                    // Default to false if no completion signals found
                    resolve(false);
                }
            });
        });
    });
}

/**
 * Wait for a specific processing status
 * @param task_id The task ID
 * @param targetStatus The status to wait for
 * @param timeoutMs Timeout in milliseconds
 * @returns Promise with boolean indicating if status was reached
 */
export async function waitForProcessingStatus(
    task_id: string, 
    targetStatus: ProcessingStatus, 
    timeoutMs = 60000
): Promise<boolean> {
    const startTime = Date.now();
    let statusCheckCount = 0;
    
    return new Promise<boolean>((resolve) => {
        // Set a timeout to avoid hanging forever
        const timeoutId = setTimeout(() => {
            console.warn(`Waiting for status ${targetStatus} timed out after ${timeoutMs}ms`);
            // Force status to completed if we're waiting for completed status and timing out
            if (targetStatus === 'completed') {
                console.warn('Forcing status to completed to avoid being stuck');
                chrome.runtime.sendMessage({
                    type: 'updateProcessingStatus',
                    task_id,
                    status: 'completed'
                }).catch(err => console.error('Error forcing status update:', err));
            }
            resolve(false);
        }, timeoutMs);
        
        // Check status periodically
        const checkStatus = async () => {
            statusCheckCount++;
            const result = await chrome.storage.local.get(['taskState']);
            const currentStatus = result.taskState?.processingStatus;
            
            console.log(`Current processing status: ${currentStatus}, waiting for: ${targetStatus} (check #${statusCheckCount})`);
            
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
            
            // If waiting for completion and stuck in executing_actions for too long, force completion
            if (targetStatus === 'completed' && currentStatus === 'executing_actions' && statusCheckCount > 10) {
                clearTimeout(timeoutId);
                console.warn('Execution taking too long, forcing completion status');
                await chrome.runtime.sendMessage({
                    type: 'updateProcessingStatus',
                    task_id,
                    status: 'completed'
                }).catch(err => console.error('Error forcing status update:', err));
                resolve(true);
                return;
            }
            
            // If we've waited too long, stop
            if (Date.now() - startTime > timeoutMs - 5000) { // Leave 5s buffer for timeout
                clearTimeout(timeoutId);
                console.warn(`Waiting for status ${targetStatus} timed out after ${Date.now() - startTime}ms`);
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

/**
 * Helper to get the latest server update from storage
 * @param task_id The task ID
 * @returns Promise with the latest update result
 */
export async function getLatestUpdateResult(task_id: string): Promise<{
    success: boolean;
    data?: any;
    error?: string;
}> {
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