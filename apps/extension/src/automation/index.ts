import { Action, AutomationHandler } from '@navigator-ai/core';

const automationHandler = new AutomationHandler();

export async function handleAutomationActions(actions: Action[]): Promise<boolean[]> {
    try {
        console.log('Executing automation actions:', actions);
        
        if (!Array.isArray(actions) || actions.length === 0) {
            console.error('Invalid actions array:', actions);
            throw new Error('Invalid actions array');
        }
        
        // Validate each action
        for (const action of actions) {
            if (!action.type) {
                console.error('Invalid action missing type:', action);
                throw new Error('Invalid action: missing type');
            }
            
            // Validate based on action type
            if (action.type === 'click' || action.type === 'scroll' || action.type === 'input') {
                if (!action.element_id && !action.xpath_ref && !action.selector) {
                    console.error('Invalid action missing target element:', action);
                    throw new Error(`Invalid ${action.type} action: missing target element`);
                }
            }
            
            if (action.type === 'input' && !action.text) {
                console.error('Invalid input action missing text:', action);
                throw new Error('Invalid input action: missing text');
            }
            
            if (action.type === 'navigate' && !action.url) {
                console.error('Invalid navigate action missing URL:', action);
                throw new Error('Invalid navigate action: missing URL');
            }
        }
        
        // Execute actions with timeout protection - longer timeout (120 seconds)
        const timeoutPromise = new Promise<boolean[]>((_, reject) => {
            setTimeout(() => {
                reject(new Error('Action execution timed out after 120 seconds'));
            }, 120000); // 2 minutes timeout
        });
        
        const results = await Promise.race([
            automationHandler.executeActions(actions),
            timeoutPromise
        ]);
        
        console.log('Action execution complete with results:', results);
        
        if (results.includes(false)) {
            const failedIndex = results.findIndex(r => r === false);
            console.warn(`Action at index ${failedIndex} failed:`, actions[failedIndex]);
        }
        
        return results;
    } catch (error) {
        console.error('Error in handleAutomationActions:', error);
        throw error; 
    }
} 