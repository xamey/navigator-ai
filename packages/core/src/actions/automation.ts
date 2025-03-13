import { Action } from '../types';

export class AutomationHandler {
    private async findElement(action: Action, retryCount = 0): Promise<Element | null> {
        console.log(`Attempting to find element (attempt ${retryCount + 1})`, action);
        
        // Try multiple approaches to find the element
        let element: Element | null = null;
        
        // First try the specified method
        if (action.element_id) {
            element = document.getElementById(action.element_id);
            console.log(`Searching by ID "${action.element_id}": ${element ? 'Found' : 'Not found'}`);
        } 
        
        // Try selector if element_id failed or was not provided
        if (!element && action.selector) {
            element = document.querySelector(action.selector);
            console.log(`Searching by selector "${action.selector}": ${element ? 'Found' : 'Not found'}`);
        } 
        
        // Try xpath if other methods failed or were not provided
        if (!element && action.xpath_ref) {
            try {
                const result = document.evaluate(
                    action.xpath_ref,
                    document,
                    null,
                    XPathResult.ANY_TYPE,
                    null
                );
                element = result.singleNodeValue as Element;
                console.log(`Searching by XPath "${action.xpath_ref}": ${element ? 'Found' : 'Not found'}`);
            } catch (error) {
                console.error(`Error evaluating XPath "${action.xpath_ref}":`, error);
            }
        }
        
        // If we have a selector but no element, try a more generic query
        if (!element && action.selector) {
            // Try a more general selector by removing IDs which might be dynamic
            const genericSelector = action.selector.replace(/#[^.#\s[\]]+/g, '*');
            if (genericSelector !== action.selector) {
                console.log(`Trying generic selector: ${genericSelector}`);
                element = document.querySelector(genericSelector);
            }
        }
        
        // If element still not found, we could try by text content or other heuristics
        if (!element && (action.text || action.type === 'click')) {
            // For click actions, try to find buttons or links with similar text
            const textToFind = action.text || 
                (action.selector?.includes('repositories') ? 'Repositories' : '') ||
                (action.element_id?.includes('repositories') ? 'Repositories' : '');
                
            if (textToFind) {
                console.log(`Trying to find element by text: "${textToFind}"`);
                
                // Look for links or buttons with this text
                const elementsWithText = Array.from(document.querySelectorAll('a, button, [role="tab"]'))
                    .filter(el => {
                        const content = el.textContent?.trim().toLowerCase() || '';
                        return content.includes(textToFind.toLowerCase());
                    });
                
                if (elementsWithText.length > 0) {
                    element = elementsWithText[0] as Element;
                    console.log(`Found element by text content:`, element);
                }
            }
        }
        
        // If element not found and we haven't exceeded retries, try again after a delay
        if (!element && retryCount < 3) {
            console.log(`Element not found, waiting and retrying (attempt ${retryCount + 1}/3)`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return this.findElement(action, retryCount + 1);
        }
        
        return element;
    }

    private async scrollToElement(element: Element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Wait for scroll to complete
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    private async simulateHumanClick(element: Element) {
        // Add some randomness to make it more human-like
        const delay = Math.random() * 200 + 100; // Random delay between 100-300ms
        await new Promise(resolve => setTimeout(resolve, delay));

        // Trigger mouse events for natural interaction
        const events = ['mousedown', 'mouseup', 'click'];
        for (const eventType of events) {
            const event = new MouseEvent(eventType, {
                bubbles: true,
                cancelable: true,
                view: window
            });
            element.dispatchEvent(event);
        }
    }

    private async simulateHumanInput(element: HTMLInputElement, text: string) {
        // Focus the element
        element.focus();

        // Clear existing value
        element.value = '';
        element.dispatchEvent(new Event('input', { bubbles: true }));

        // Type each character with random delays
        for (const char of text) {
            const delay = Math.random() * 100 + 50; // Random delay between 50-150ms
            await new Promise(resolve => setTimeout(resolve, delay));
            
            element.value += char;
            element.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Trigger change event after typing
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    async executeAction(action: Action, retryCount = 0): Promise<boolean> {
        try {
            console.log('Executing action:', action.type, action);

            // First try to find the element
            const element = await this.findElement(action);
            if (!element && action.type !== 'navigate') {
                console.error('Element not found for action:', action);
                
                // If we haven't exceeded retries, try again
                if (retryCount < 2) {
                    console.log(`Action failed, waiting and retrying (attempt ${retryCount + 1}/2)`);
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait longer between retries
                    return this.executeAction(action, retryCount + 1);
                }
                
                return false;
            }

            // Special case for GitHub repositories tab
            if (action.selector === '#repositories-tab' || action.element_id === 'repositories-tab') {
                console.log('Special case: Looking for repositories tab by various means');
                
                // Try finding by aria-label
                const repoTab = document.querySelector('[aria-label="Repositories"]') || 
                                document.querySelector('[data-tab-item="repositories"]') ||
                                Array.from(document.querySelectorAll('a')).find(a => 
                                    a.textContent?.trim().toLowerCase() === 'repositories'
                                );
                
                if (repoTab && !element) {
                    console.log('Found repositories tab by alternative means:', repoTab);
                    await this.scrollToElement(repoTab);
                    await this.simulateHumanClick(repoTab);
                    return true;
                }
            }

            switch (action.type) {
                case 'click':
                    if (!element) return false;
                    await this.scrollToElement(element);
                    await this.simulateHumanClick(element);
                    
                    // Add a longer wait after clicking to ensure page updates
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    break;

                case 'input':
                    if (!element || !action.text) return false;
                    await this.scrollToElement(element);
                    await this.simulateHumanInput(element as HTMLInputElement, action.text);
                    break;

                case 'scroll':
                    if (!element) return false;
                    await this.scrollToElement(element);
                    break;

                case 'navigate':
                    if (!action.url) return false;
                    console.log(`Navigating to: ${action.url}`);
                    window.location.href = action.url;
                    // Wait longer for navigation to complete
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    break;

                default:
                    console.error('Unknown action type:', action.type);
                    return false;
            }

            console.log(`Action ${action.type} executed successfully`);
            return true;
        } catch (error) {
            console.error('Error executing action:', error);
            
            // If we haven't exceeded retries, try again
            if (retryCount < 2) {
                console.log(`Action failed with error, waiting and retrying (attempt ${retryCount + 1}/2)`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return this.executeAction(action, retryCount + 1);
            }
            
            return false;
        }
    }

    async executeActions(actions: Action[]): Promise<boolean[]> {
        const results: boolean[] = [];
        
        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            console.log(`Executing action ${i+1} of ${actions.length}:`, action.type);
            
            try {
                const success = await this.executeAction(action);
                results.push(success);
                
                if (!success) {
                    console.error(`Action ${i+1} (${action.type}) failed. Continuing with next action.`);
                } else {
                    console.log(`Action ${i+1} (${action.type}) completed successfully`);
                }
                
                // Add a longer delay between actions (1 second)
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`Unexpected error in action ${i+1} (${action.type}):`, error);
                results.push(false);
                // Continue with next action despite errors
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log(`Executed ${actions.length} actions with results:`, results);
        return results;
    }
} 