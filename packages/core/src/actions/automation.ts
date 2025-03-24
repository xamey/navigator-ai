import { Action } from '../types';
import { AutomationOptions, ExecuteActionResult } from '../types';
import { CursorManager } from '../utils/cursor';
import { ElementFinder } from '../utils/element-finder';
import { DomActions } from '../utils/dom-actions';

declare global {
    interface Window {
        navigatorAI?: {
            debugMode?: boolean;
            cursorSize?: number;
            cursorHandler?: AutomationHandler;
            getHandler: () => AutomationHandler;
            initHandler: () => AutomationHandler;
        };
        getNavigatorCursor: () => AutomationHandler;
        initNavigatorCursor: () => AutomationHandler;
    }
}

export interface IAutomationHandler {
    setDebugMode(enable: boolean): void;
    setCursorSize(size: number): void;
    ensureCursorVisible(): void;
    executeAction(action: Action, retryCount?: number): Promise<ExecuteActionResult>;
    executeActions(actions: Action[]): Promise<ExecuteActionResult[]>;
}

let globalHandlerInstance: AutomationHandler | null = null;

export function initAutomationHandler(options?: AutomationOptions): IAutomationHandler {
    return AutomationHandler.getInstance(options);
}

export class AutomationHandler implements IAutomationHandler {
    cursorManager: CursorManager;
    elementFinder: ElementFinder;
    domActions: DomActions;
    debugMode = false;
    cursorSize = 32;
    cursorUI?: string;

    constructor(options?: AutomationOptions) {
        this.debugMode = options?.debug ?? false;
        this.cursorSize = options?.cursorSize ?? 32;
        this.cursorUI = options?.cursorUI;

        this.cursorManager = new CursorManager({
            debug: this.debugMode,
            cursorSize: this.cursorSize
        });

        this.elementFinder = new ElementFinder({
            debug: this.debugMode
        });

        this.domActions = new DomActions({
            debug: this.debugMode
        });

        globalHandlerInstance = this;

        if (typeof window !== 'undefined') {
            if (!window.navigatorAI) {
                window.navigatorAI = {
                    debugMode: this.debugMode,
                    cursorSize: this.cursorSize,
                    cursorHandler: this,
                    getHandler: () => globalHandlerInstance || this,
                    initHandler: () => {
                        if (!globalHandlerInstance) {
                            globalHandlerInstance = new AutomationHandler({
                                debug: this.debugMode,
                                cursorSize: this.cursorSize
                            });
                        }
                        return globalHandlerInstance;
                    }
                };
            } else {
                // Update existing navigatorAI object
                window.navigatorAI.cursorHandler = this;
                window.navigatorAI.debugMode = this.debugMode;
                window.navigatorAI.cursorSize = this.cursorSize;
                window.navigatorAI.getHandler = () => globalHandlerInstance || this;
                window.navigatorAI.initHandler = () => {
                    if (!globalHandlerInstance) {
                        globalHandlerInstance = new AutomationHandler({
                            debug: this.debugMode,
                            cursorSize: this.cursorSize
                        });
                    }
                    return globalHandlerInstance;
                };
            }

            window.getNavigatorCursor = () => {
                if (!globalHandlerInstance) {
                    console.log('Creating new AutomationHandler instance');
                    return new AutomationHandler({ debug: true });
                }
                return globalHandlerInstance;
            };

            window.initNavigatorCursor = () => {
                console.log('Initializing Navigator AI cursor');
                if (!globalHandlerInstance) {
                    globalHandlerInstance = new AutomationHandler({ debug: true });
                }
                globalHandlerInstance.ensureCursorVisible();
                return globalHandlerInstance;
            };
        }

        this.initializeCursor();
    }

    public ensureCursorVisible(): void {
        this.cursorManager.ensureCursorVisible();
    }

    public static getInstance(options?: AutomationOptions): AutomationHandler {
        if (!globalHandlerInstance) {
            globalHandlerInstance = new AutomationHandler(options);
        }
        return globalHandlerInstance;
    }

    public setDebugMode(enable: boolean): void {
        this.debugMode = enable;

        this.cursorManager.setDebugMode(enable);
        this.elementFinder.setDebugMode(enable);
        this.domActions.setDebugMode(enable);

        if (typeof window !== 'undefined' && window.navigatorAI) {
            window.navigatorAI.debugMode = enable;
        }

        console.log(`Navigator AI debug mode ${enable ? 'enabled' : 'disabled'}`);

        if (enable) {
            const existingOverlay = document.getElementById('navigator-ai-debug');
            if (!existingOverlay) {
                // Create a debug overlay
                const debugOverlay = document.createElement('div');
                debugOverlay.id = 'navigator-ai-debug';
                debugOverlay.style.position = 'fixed';
                debugOverlay.style.bottom = '10px';
                debugOverlay.style.right = '10px';
                debugOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                debugOverlay.style.color = 'white';
                debugOverlay.style.padding = '5px 10px';
                debugOverlay.style.borderRadius = '5px';
                debugOverlay.style.fontFamily = 'monospace';
                debugOverlay.style.fontSize = '12px';
                debugOverlay.style.zIndex = '2147483646';
                debugOverlay.textContent = 'Navigator AI Debug: ON';
                document.body.appendChild(debugOverlay);
            }
        } else {
            const debugOverlay = document.getElementById('navigator-ai-debug');
            if (debugOverlay && debugOverlay.parentNode) {
                debugOverlay.parentNode.removeChild(debugOverlay);
            }
        }
    }

    public setCursorSize(size: number): void {
        this.cursorSize = size;
        this.cursorManager.setCursorSize(size);

        if (typeof window !== 'undefined' && window.navigatorAI) {
            window.navigatorAI.cursorSize = size;
        }

        console.log(`Navigator AI cursor size set to ${size}px`);
    }

    private initializeCursor(): void {
        if (typeof document === 'undefined') return;

        try {
            const existingCursor = document.getElementById('navigator-ai-cursor');
            if (existingCursor && existingCursor.parentNode) {
                existingCursor.parentNode.removeChild(existingCursor);
            }

            this.cursorManager.initializeCursor();

            if (this.debugMode) {
                console.log('Navigator AI cursor initialized', this.cursorManager.cursorElement);

                // Create a debug overlay
                const debugOverlay = document.createElement('div');
                debugOverlay.id = 'navigator-ai-debug';
                debugOverlay.style.position = 'fixed';
                debugOverlay.style.bottom = '10px';
                debugOverlay.style.right = '10px';
                debugOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                debugOverlay.style.color = 'white';
                debugOverlay.style.padding = '5px 10px';
                debugOverlay.style.borderRadius = '5px';
                debugOverlay.style.fontFamily = 'monospace';
                debugOverlay.style.fontSize = '12px';
                debugOverlay.style.zIndex = '2147483646';
                debugOverlay.textContent = 'Navigator AI Debug: ON';
                document.body.appendChild(debugOverlay);
            }
        } catch (error) {
            console.error('Failed to initialize cursor:', error);
        }
    }

    private async findElement(action: Action, retryCount = 0): Promise<Element | null> {
        console.log(`Attempting to find element (attempt ${retryCount + 1})`, action);

        let element: Element | null = null;

        if (action.element_id) {
            element = document.getElementById(action.element_id);
            console.log(`Searching by ID "${action.element_id}": ${element ? 'Found' : 'Not found'}`);
        }

        if (!element && action.selector && action.selector.includes('#')) {
            try {
                const escapedSelector = this.escapeSelector(action.selector);
                element = document.querySelector(escapedSelector);
                console.log(`Searching by ID selector "${escapedSelector}": ${element ? 'Found' : 'Not found'}`);
            } catch (error) {
                console.error(`Error with ID selector "${action.selector}":`, error);
            }
        }

        if (!element && action.xpath_ref) {
            try {
                const result = document.evaluate(
                    action.xpath_ref,
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                );
                element = result.singleNodeValue as Element;
                console.log(`Searching by XPath "${action.xpath_ref}": ${element ? 'Found' : 'Not found'}`);
            } catch (error) {
                console.error(`Error evaluating XPath "${action.xpath_ref}":`, error);
            }
        }

        if (!element && action.selector && !action.selector.includes('#')) {
            try {
                const escapedSelector = this.escapeSelector(action.selector);
                element = document.querySelector(escapedSelector);
                console.log(`Searching by selector "${escapedSelector}": ${element ? 'Found' : 'Not found'}`);

                if (!element) {
                    const genericSelector = action.selector.replace(/#[^.#\s[\]]+/g, '*');
                    if (genericSelector !== action.selector) {
                        const escapedGenericSelector = this.escapeSelector(genericSelector);
                        console.log(`Trying generic selector: ${escapedGenericSelector}`);
                        element = document.querySelector(escapedGenericSelector);
                    }
                }
            } catch (error) {
                console.error(`Error with selector "${action.selector}":`, error);
            }
        }

        if (!element) {
            const iframes = document.querySelectorAll('iframe');
            for (let i = 0; i < iframes.length; i++) {
                try {
                    const iframe = iframes[i];
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

                    if (iframeDoc) {
                        if (action.element_id) {
                            element = iframeDoc.getElementById(action.element_id);
                            if (element) break;
                        }

                        if (action.selector) {
                            try {
                                element = iframeDoc.querySelector(this.escapeSelector(action.selector));
                                if (element) break;
                            } catch (e) {
                                console.log(`Error with selector in iframe:`, e);
                            }
                        }
                    }
                } catch (error) {
                    console.log(`Cannot access iframe content due to security restrictions`);
                }
            }
        }

        if (element && !this.elementFinder.isElementVisible(element)) {
            console.log('Element found but not visible, looking for alternatives');

            if (action.type === 'click') {
                const parent = element.parentElement;
                if (parent) {
                    const nearbyElements = Array.from(parent.querySelectorAll('a, button, [role="button"], input[type="submit"]'))
                        .filter(el => this.elementFinder.isElementVisible(el as Element));

                    if (nearbyElements.length > 0) {
                        element = nearbyElements[0] as Element;
                        console.log('Found nearby visible interactive element instead:', element);
                    }
                }
            }
        }

        if (!element && retryCount < 3) {
            console.log(`Element not found, waiting and retrying (attempt ${retryCount + 1}/3)`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Increasing wait time
            return this.findElement(action, retryCount + 1);
        }

        return element;
    }

    private escapeSelector(selector: string): string {
        if (selector.includes(':') || selector.includes('.') || selector.includes('#')) {
            try {
                if (typeof CSS !== 'undefined' && CSS.escape) {
                    // Split by spaces and escape each part separately to handle complex selectors
                    return selector.split(/\s+/)
                        .map(part => {
                            // Handle ID and class selectors separately
                            if (part.startsWith('#') || part.startsWith('.')) {
                                const prefix = part.charAt(0);
                                const value = part.substring(1);
                                return prefix + CSS.escape(value);
                            }
                            return part;
                        })
                        .join(' ');
                } else {
                    // Fallback: manually escape special characters
                    return selector.replace(/(:)/g, '\\$1');
                }
            } catch (e) {
                console.error('Error escaping selector:', e);
                return selector; // Return original if escaping fails
            }
        }
        return selector;
    }


    private async scrollToElement(element: Element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Wait for scroll to complete
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    async executeAction(action: Action, retryCount = 0): Promise<ExecuteActionResult> {
        try {
            console.log('Executing action:', action.type, action);

            const element = await this.findElement(action);
            if (!element && action.type !== 'navigate' && action.type !== 'url') {
                console.error('Element not found for action:', action);

                if (retryCount < 2) {
                    console.log(`Action failed, waiting and retrying (attempt ${retryCount + 1}/2)`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    return this.executeAction(action, retryCount + 1);
                }

                return { success: false, message: `Element not found at any selector or xpath for action config: ${action}` };
            }

            if (element && action.type !== 'navigate' && action.type !== 'url') {
                if (this.debugMode) {
                    const rect = element.getBoundingClientRect();
                    console.log('Element details:', {
                        tag: element.tagName,
                        id: element.id,
                        class: element.className,
                        position: {
                            left: rect.left,
                            top: rect.top,
                            width: rect.width,
                            height: rect.height
                        },
                        visible: this.elementFinder.isElementVisible(element)
                    });
                }

                await this.scrollToElement(element);
                await this.cursorManager.moveCursorToElement(element);
            }

            if (!element)
                return {
                    success: false,
                    message: `Element not found at any selector or xpath for action config: ${action}`
                }

            switch (action.type) {
                case 'click':
                    await this.domActions.simulateHumanClick(element);
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    break;

                case 'input':
                    if (!action.text)
                        return {
                            success: false,
                            message: `Action ${action} could not be executed as text not provided`
                        }
                    await this.domActions.simulateHumanInput(
                        element as HTMLInputElement,
                        action.text,
                        true
                    );
                    break;

                case 'scroll':
                    // Element is already scrolled into view by this point
                    break;

                case 'navigate':
                case 'url':
                    if (!action.url) return {success: false, message: `Action ${action} could not be executed as url not provided`};
                    console.log(`Navigating to: ${action.url}`);

                    this.cursorManager.showNavigationFeedback(action.url);

                    await new Promise(resolve => setTimeout(resolve, 800));

                    window.location.href = action.url;

                    await new Promise(resolve => setTimeout(resolve, 3000));
                    break;

                default:
                    console.error('Unknown action type:', action.type);
                    this.cursorManager.hideCursor();
                    return {
                        success: false,
                        message: `Unknown action type: ${action}`
                    };
            }

            this.cursorManager.hideCursor();

            console.log(`Action ${action.type} executed successfully`);
            return {
                success: true,
                message: `Action ${action} executed successfully`
            };
        } catch (error) {
            console.error('Error executing action:', error);
            this.cursorManager.hideCursor();

            // If we haven't exceeded retries, try again
            if (retryCount < 2) {
                console.log(`Action failed with error, retrying (attempt ${retryCount + 1}/2)`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return this.executeAction(action, retryCount + 1);
            }

            return {
                success: false,
                message: `Failed to execute action for config ${action}`
            };
        }
    }

    async executeActions(actions: Action[]): Promise<ExecuteActionResult[]> {
        const results: ExecuteActionResult[] = [];

        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            console.log(`Executing action ${i + 1} of ${actions.length}:`, action.type);

            try {
                const success = await this.executeAction(action);
                results.push(success);

                if (!success) {
                    console.error(`Action ${i + 1} (${action.type}) failed. Continuing with next action.`);
                } else {
                    console.log(`Action ${i + 1} (${action.type}) completed successfully`);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`Unexpected error in action ${i + 1} (${action.type}):`, error);
                results.push({
                    success: false,
                    message: `Unexpected error in action ${i + 1} (${action.type}): error: ${error}`
                });
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log(`Executed ${actions.length} actions with results:`, results);
        return results;
    }
} 