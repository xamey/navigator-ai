import { Action, AutomationHandler } from '@navigator-ai/core';

// Define the interface locally until the core package is rebuilt
interface IAutomationHandler {
    setDebugMode?: (enable: boolean) => void;
    setCursorSize?: (size: number) => void;
    ensureCursorVisible?: () => void;
    executeAction: (action: Action, retryCount?: number) => Promise<boolean>;
    executeActions: (actions: Action[]) => Promise<boolean[]>;
}

// Define types for global objects
declare global {
    interface Window {
        navigatorAI?: {
            cursorHandler?: IAutomationHandler;
            debugMode?: boolean;
            cursorSize?: number;
            getHandler?: () => IAutomationHandler;
            initHandler?: () => IAutomationHandler;
        };
        getNavigatorCursor?: () => IAutomationHandler;
        initNavigatorCursor?: () => IAutomationHandler;
    }
}

// Create a new automation handler with debug mode
let automationHandler: IAutomationHandler;
try {
    automationHandler = new AutomationHandler();
    
    // Enable debug mode to help troubleshoot
    if (typeof (automationHandler as any).setDebugMode === 'function') {
        (automationHandler as any).setDebugMode(true);
    }
} catch (error) {
    console.error('Error creating AutomationHandler:', error);
    // Create a fallback handler that does nothing but doesn't crash
    automationHandler = {
        executeAction: async () => false,
        executeActions: async () => []
    };
}

export async function handleAutomationActions(actions: Action[]): Promise<boolean[]> {
    try {
        console.log('Executing automation actions:', actions);
        
        if (!Array.isArray(actions) || actions.length === 0) {
            console.error('Invalid actions array:', actions);
            throw new Error('Invalid actions array');
        }
        
        // Ensure automation handler is properly initialized
        try {
            // Make sure the cursor will be visible
            if (typeof (automationHandler as any).ensureCursorVisible === 'function') {
                (automationHandler as any).ensureCursorVisible();
            }
            
            // For debugging - expose on window
            if (typeof window !== 'undefined') {
                if (!window.navigatorAI || !window.navigatorAI.cursorHandler) {
                    console.log('Re-initializing Navigator AI cursor handler');
                    window.navigatorAI = {
                        ...(window.navigatorAI || {}),
                        cursorHandler: automationHandler,
                        debugMode: true,
                        cursorSize: 32,
                        getHandler: () => automationHandler,
                        initHandler: () => automationHandler
                    };
                    window.getNavigatorCursor = () => automationHandler;
                    window.initNavigatorCursor = () => {
                        if (typeof (automationHandler as any).ensureCursorVisible === 'function') {
                            (automationHandler as any).ensureCursorVisible();
                        }
                        return automationHandler;
                    };
                }
            }
        } catch (initError) {
            console.error('Error initializing cursor:', initError);
            // Continue execution even if cursor initialization fails
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
            const failedIndex = results.findIndex((result: boolean) => result === false);
            console.warn(`Action at index ${failedIndex} failed:`, actions[failedIndex]);
        }
        
        return results;
    } catch (error) {
        console.error('Error in handleAutomationActions:', error);
        throw error; 
    }
} 