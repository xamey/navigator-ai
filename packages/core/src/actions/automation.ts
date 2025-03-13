import { Action } from '../types';

export class AutomationHandler {
    private async findElement(action: Action): Promise<Element | null> {
        if (action.element_id) {
            return document.getElementById(action.element_id);
        } else if (action.xpath_ref) {
            const result = document.evaluate(
                action.xpath_ref,
                document,
                null,
                XPathResult.ANY_TYPE,
                null
            );
            return result.singleNodeValue as Element;
        } else if (action.selector) {
            return document.querySelector(action.selector);
        }
        return null;
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

    async executeAction(action: Action): Promise<boolean> {
        try {
            console.log('Executing action:', action.type);

            const element = await this.findElement(action);
            if (!element && action.type !== 'navigate') {
                console.error('Element not found for action:', action);
                return false;
            }

            switch (action.type) {
                case 'click':
                    if (!element) return false;
                    await this.scrollToElement(element);
                    await this.simulateHumanClick(element);
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
                    window.location.href = action.url;
                    // Wait for navigation
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    break;

                default:
                    console.error('Unknown action type:', action.type);
                    return false;
            }

            return true;
        } catch (error) {
            console.error('Error executing action:', error);
            return false;
        }
    }

    async executeActions(actions: Action[]): Promise<boolean[]> {
        const results: boolean[] = [];
        
        for (const action of actions) {
            const success = await this.executeAction(action);
            results.push(success);
            
            // Add a small delay between actions
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        return results;
    }
} 