import { Action } from '../types';

declare global {
    interface Window {
        chrome?: {
            runtime: {
                getURL: (path: string) => string;
            };
        };
        navigatorAI?: {
            debugMode?: boolean;
            cursorSize?: number;
            cursorHandler?: AutomationHandler;
            getHandler: () => AutomationHandler;
            initHandler: () => AutomationHandler;
        };
        // Global function to ensure handler is always available
        getNavigatorCursor: () => AutomationHandler;
        initNavigatorCursor: () => AutomationHandler;
    }
}

/**
 * Define public interface for AutomationHandler
 * This helps with TypeScript type checking in consuming code
 */
export interface IAutomationHandler {
    setDebugMode(enable: boolean): void;
    setCursorSize(size: number): void;
    ensureCursorVisible(): void;
    executeAction(action: Action, retryCount?: number): Promise<boolean>;
    executeActions(actions: Action[]): Promise<boolean[]>;
}

// Singleton instance
let globalHandlerInstance: AutomationHandler | null = null;

// Initialize the automation handler (for direct imports)
export function initAutomationHandler(options?: { debug?: boolean, cursorSize?: number }): IAutomationHandler {
    return AutomationHandler.getInstance(options);
}

export class AutomationHandler implements IAutomationHandler {
    private cursorElement: HTMLImageElement | null = null;
    private debugMode = false; // Set to true to enable additional debug logging
    private cursorSize = 32; // Default size in pixels
    
    constructor(options?: { debug?: boolean, cursorSize?: number }) {
        // Set options
        this.debugMode = options?.debug ?? false;
        this.cursorSize = options?.cursorSize ?? 32;
        
        // Store as singleton instance
        globalHandlerInstance = this;
        
        // Expose instance to window for debugging
        if (typeof window !== 'undefined') {
            // Ensure navigatorAI exists
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
            
            // Add global getter function
            window.getNavigatorCursor = () => {
                if (!globalHandlerInstance) {
                    console.log('Creating new AutomationHandler instance');
                    return new AutomationHandler({ debug: true });
                }
                return globalHandlerInstance;
            };
            
            // Add global init function
            window.initNavigatorCursor = () => {
                console.log('Initializing Navigator AI cursor');
                if (!globalHandlerInstance) {
                    globalHandlerInstance = new AutomationHandler({ debug: true });
                }
                globalHandlerInstance.ensureCursorVisible();
                return globalHandlerInstance;
            };
        }
        
        // Create the cursor element when AutomationHandler is instantiated
        this.initializeCursor();
    }
    
    /**
     * Ensure the cursor is visible (useful for debugging)
     */
    public ensureCursorVisible(): void {
        if (!this.cursorElement) {
            this.initializeCursor();
        }
        
        if (this.cursorElement) {
            console.log('Setting cursor to visible in center of screen');
            
            // In case the cursor was removed from DOM
            if (!document.body.contains(this.cursorElement)) {
                document.body.appendChild(this.cursorElement);
            }
            
            // Show cursor at center of screen
            this.cursorElement.style.transition = 'none';
            this.cursorElement.style.left = `${window.innerWidth / 2}px`;
            this.cursorElement.style.top = `${window.innerHeight / 2}px`;
            this.cursorElement.style.display = 'block';
            this.cursorElement.style.opacity = '1';
            
            // Make cursor larger for testing
            this.cursorElement.style.width = `${this.cursorSize * 1.5}px`;
            this.cursorElement.style.height = `${this.cursorSize * 1.5}px`;
            
            // Add animation to make cursor obvious
            this.cursorElement.animate([
                { transform: 'translate(-50%, -50%) scale(1)', filter: 'brightness(1)' },
                { transform: 'translate(-50%, -50%) scale(2)', filter: 'brightness(1.5)' },
                { transform: 'translate(-50%, -50%) scale(1)', filter: 'brightness(1)' }
            ], {
                duration: 800,
                iterations: 2
            });
            
            // Reset cursor after animation
            setTimeout(() => {
                if (this.cursorElement) {
                    this.cursorElement.style.width = `${this.cursorSize}px`;
                    this.cursorElement.style.height = `${this.cursorSize}px`;
                }
            }, 1600);
        }
    }
    
    /**
     * Static method to get or create an instance
     */
    public static getInstance(options?: { debug?: boolean, cursorSize?: number }): AutomationHandler {
        if (!globalHandlerInstance) {
            globalHandlerInstance = new AutomationHandler(options);
        }
        return globalHandlerInstance;
    }
    
    /**
     * Enable or disable debug mode
     * @param enable Whether to enable debug mode
     */
    public setDebugMode(enable: boolean): void {
        this.debugMode = enable;
        
        if (typeof window !== 'undefined' && window.navigatorAI) {
            window.navigatorAI.debugMode = enable;
        }
        
        console.log(`Navigator AI debug mode ${enable ? 'enabled' : 'disabled'}`);
        
        // Update debug overlay if debug mode was enabled
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
            // Remove debug overlay if debug mode was disabled
            const debugOverlay = document.getElementById('navigator-ai-debug');
            if (debugOverlay && debugOverlay.parentNode) {
                debugOverlay.parentNode.removeChild(debugOverlay);
            }
        }
    }
    
    /**
     * Set cursor size
     * @param size Size in pixels
     */
    public setCursorSize(size: number): void {
        this.cursorSize = size;
        
        if (this.cursorElement) {
            this.cursorElement.style.width = `${size}px`;
            this.cursorElement.style.height = `${size}px`;
        }
        
        if (typeof window !== 'undefined' && window.navigatorAI) {
            window.navigatorAI.cursorSize = size;
        }
        
        console.log(`Navigator AI cursor size set to ${size}px`);
    }
    
    private initializeCursor(): void {
        // Check if we're in a browser environment
        if (typeof document === 'undefined') return;
        
        try {
            // Remove any existing cursor element to avoid duplicates
            const existingCursor = document.getElementById('navigator-ai-cursor');
            if (existingCursor && existingCursor.parentNode) {
                existingCursor.parentNode.removeChild(existingCursor);
            }
            
            // Create cursor element using an image instead of a div with styling
            this.cursorElement = document.createElement('img');
            this.cursorElement.id = 'navigator-ai-cursor';
            
            // Get URL for the cursor image, falling back to a data URL if chrome isn't available
            if (window.chrome && window.chrome.runtime) {
                this.cursorElement.src = window.chrome.runtime.getURL('assets/icon/cursor.png');
            } else {
                // Fallback to an inline cursor using data URL
                this.cursorElement.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNCIgZmlsbD0icmdiYSg3NSwgMjAwLCAyNTUsIDAuNSkiIHN0cm9rZT0icmdiKDAsIDE1MCwgMjU1KSIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+';
            }
            
            this.cursorElement.style.position = 'fixed';
            this.cursorElement.style.width = `${this.cursorSize}px`;
            this.cursorElement.style.height = `${this.cursorSize}px`;
            this.cursorElement.style.pointerEvents = 'none'; // Ensure it doesn't interfere with user interactions
            this.cursorElement.style.zIndex = '2147483647'; // Maximum z-index value
            this.cursorElement.style.transform = 'translate(-50%, -50%)';
            this.cursorElement.style.transition = 'all 0.3s ease-out';
            this.cursorElement.style.display = 'none';
            this.cursorElement.style.filter = 'drop-shadow(0 0 5px rgba(0, 150, 255, 0.8))';
            this.cursorElement.style.willChange = 'transform, left, top'; // Performance optimization
            
            // Add cursor to body
            document.body.appendChild(this.cursorElement);
            
            if (this.debugMode) {
                console.log('Navigator AI cursor initialized', this.cursorElement);
                
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
    
    private async moveCursorToElement(element: Element): Promise<void> {
        if (!this.cursorElement) {
            this.initializeCursor();
        }
        
        if (!this.cursorElement) {
            if (this.debugMode) console.error('Cursor element is null after initialization attempt');
            return; // In case initialization failed
        }
        
        try {
            // Get the bounding rect of the element
            const rect = element.getBoundingClientRect();
            
            // Calculate the center position
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            if (this.debugMode) {
                console.log(`Moving cursor to element at (${centerX}, ${centerY})`, element);
            }
            
            // Make the cursor visible
            this.cursorElement.style.display = 'block';
            
            // First position without animation
            this.cursorElement.style.transition = 'none';
            this.cursorElement.style.left = `${window.innerWidth / 2}px`;
            this.cursorElement.style.top = `${window.innerHeight / 2}px`;
            
            // Force reflow to ensure the initial position takes effect
            void this.cursorElement.offsetWidth;
            
            // Restore animation and move to target
            this.cursorElement.style.transition = 'all 0.5s cubic-bezier(0.19, 1, 0.22, 1)';
            this.cursorElement.style.left = `${centerX}px`;
            this.cursorElement.style.top = `${centerY}px`;
            
            // Use animations for cursor effects
            this.cursorElement.animate([
                { transform: 'translate(-50%, -50%) scale(0.8)', opacity: 0.7 },
                { transform: 'translate(-50%, -50%) scale(1.2)', opacity: 1 },
                { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.9 }
            ], {
                duration: 600,
                iterations: 1
            });
            
            // Wait for the cursor to arrive at its destination
            await new Promise(resolve => setTimeout(resolve, 600));
        } catch (error) {
            console.error('Error moving cursor to element:', error);
        }
    }
    
    private hideCursor(): void {
        if (!this.cursorElement) return;
        
        try {
            // Animate the cursor fading out
            this.cursorElement.animate([
                { opacity: 1 },
                { opacity: 0 }
            ], {
                duration: 300,
                easing: 'ease-out',
                fill: 'forwards'
            });
            
            // Actually hide the cursor after animation completes
            setTimeout(() => {
                if (this.cursorElement) {
                    this.cursorElement.style.display = 'none';
                    // Reset opacity after hiding
                    this.cursorElement.style.opacity = '1';
                }
            }, 300);
        } catch (error) {
            // If animation fails, just hide it immediately
            if (this.debugMode) {
                console.error('Error hiding cursor with animation:', error);
            }
            this.cursorElement.style.display = 'none';
        }
    }

    private async findElement(action: Action, retryCount = 0): Promise<Element | null> {
        console.log(`Attempting to find element (attempt ${retryCount + 1})`, action);

        let element: Element | null = null;

        // First try: element_id (highest priority)
        if (action.element_id) {
            element = document.getElementById(action.element_id);
            console.log(`Searching by ID "${action.element_id}": ${element ? 'Found' : 'Not found'}`);
        }

        // Second try: if selector contains '#', try it before xpath
        if (!element && action.selector && action.selector.includes('#')) {
            try {
                const escapedSelector = this.escapeSelector(action.selector);
                element = document.querySelector(escapedSelector);
                console.log(`Searching by ID selector "${escapedSelector}": ${element ? 'Found' : 'Not found'}`);
            } catch (error) {
                console.error(`Error with ID selector "${action.selector}":`, error);
            }
        }

        // Third try: xpath_ref
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

        // Fourth try: other selectors that don't contain '#'
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

        // Last try: text-based search
        if (!element && (action.text || action.type === 'click')) {
            const textToFind = action.text ||
                (action.selector?.includes('repositories') ? 'Repositories' : '') ||
                (action.element_id?.includes('repositories') ? 'Repositories' : '');

            if (textToFind) {
                console.log(`Trying to find element by text: "${textToFind}"`);

                const elementsWithText = Array.from(
                    document.querySelectorAll('a, button, [role="tab"], [role="button"], input[type="submit"], input[type="button"], .btn, nav li, [aria-label*="' + textToFind + '"], [title*="' + textToFind + '"]')
                ).filter(el => {
                    const content = el.textContent?.trim().toLowerCase() || '';
                    if (content.includes(textToFind.toLowerCase())) return true;

                    for (const child of Array.from(el.children)) {
                        if (child.textContent?.trim().toLowerCase().includes(textToFind.toLowerCase())) {
                            return true;
                        }
                    }

                    const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
                    const title = el.getAttribute('title')?.toLowerCase() || '';
                    const alt = el.getAttribute('alt')?.toLowerCase() || '';
                    const placeholder = el.getAttribute('placeholder')?.toLowerCase() || '';

                    return ariaLabel.includes(textToFind.toLowerCase()) ||
                        title.includes(textToFind.toLowerCase()) ||
                        alt.includes(textToFind.toLowerCase()) ||
                        placeholder.includes(textToFind.toLowerCase());
                });

                if (elementsWithText.length > 0) {
                    const visibleElements = elementsWithText.filter(el => this.isElementVisible(el as Element));
                    element = visibleElements.length > 0 ? visibleElements[0] as Element : elementsWithText[0] as Element;
                    console.log(`Found element by text content:`, element);
                }
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

        if (element && !this.isElementVisible(element)) {
            console.log('Element found but not visible, looking for alternatives');

            if (action.type === 'click') {
                const parent = element.parentElement;
                if (parent) {
                    const nearbyElements = Array.from(parent.querySelectorAll('a, button, [role="button"], input[type="submit"]'))
                        .filter(el => this.isElementVisible(el as Element));

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

    private isElementVisible(element: Element): boolean {
    if (!element || !(element instanceof HTMLElement)) return false;
    
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
    }
    
    // Check if element has zero size
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
        return false;
    }
    
    // Check if element is within viewport
    const isInViewport = (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
    
    // Element might still be valid even if not in viewport, but we prioritize visible elements
    return true;
}

    private escapeSelector(selector: string): string {
        // If the selector contains potential special characters that need escaping
        if (selector.includes(':') || selector.includes('.') || selector.includes('#')) {
            try {
                // CSS.escape is the proper way but might not be available in all environments
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

    private async simulateHumanClick(element: Element) {
        // Add a visual indication of clicking
        if (this.cursorElement) {
            try {
                // Change cursor appearance to indicate a click
                this.cursorElement.animate([
                    { transform: 'translate(-50%, -50%) scale(1)', filter: 'brightness(1)' },
                    { transform: 'translate(-50%, -50%) scale(0.7)', filter: 'brightness(1.5) hue-rotate(290deg)' },
                    { transform: 'translate(-50%, -50%) scale(1)', filter: 'brightness(1)' }
                ], {
                    duration: 400,
                    iterations: 1
                });
                
                // Wait for animation to complete
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.error('Error animating cursor click:', error);
            }
        }
        
        const rect = element.getBoundingClientRect();
        const centerX = Math.floor(rect.left + rect.width / 2);
        const centerY = Math.floor(rect.top + rect.height / 2);

        // Move mouse to element with a mousedown and mouseup event for more natural interaction
        element.dispatchEvent(new MouseEvent('mouseover', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: centerX,
            clientY: centerY
        }));

        element.dispatchEvent(new MouseEvent('mousedown', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: centerX,
            clientY: centerY
        }));

        // Small delay between mousedown and mouseup/click
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

        element.dispatchEvent(new MouseEvent('mouseup', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: centerX,
            clientY: centerY
        }));

        element.dispatchEvent(new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: centerX,
            clientY: centerY
        }));
    }

    private async simulateHumanInput(element: HTMLInputElement, text: string) {
        // Focus the input element first
        element.focus();
        
        // Clear existing value if any
        element.value = '';
        
        // Indicate typing with cursor
        if (this.cursorElement) {
            try {
                // Change cursor to indicate it's about to type (using filter instead of background-color)
                this.cursorElement.style.filter = 'hue-rotate(120deg) drop-shadow(0 0 5px rgba(0, 255, 100, 0.8))';
            } catch (error) {
                console.error('Error changing cursor for typing:', error);
            }
        }
        
        // Type characters with human-like delays
        for (let i = 0; i < text.length; i++) {
            const char = text.charAt(i);
            
            // Add character to input
            element.value += char;
            
            // Trigger input event
            element.dispatchEvent(new Event('input', { bubbles: true }));
            
            // Random typing speed delay between 30-100ms
            const typingDelay = Math.floor(Math.random() * 70) + 30;
            await new Promise(resolve => setTimeout(resolve, typingDelay));
            
            // Occasionally add a longer pause (1 in 8 chance)
            if (Math.random() < 0.125 && i < text.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 200));
            }
        }
        
        // Return cursor to normal appearance
        if (this.cursorElement) {
            this.cursorElement.style.filter = 'drop-shadow(0 0 5px rgba(0, 150, 255, 0.8))';
        }
        
        // Trigger change event after completion
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Small delay after typing completes
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    async executeAction(action: Action, retryCount = 0): Promise<boolean> {
        try {
            console.log('Executing action:', action.type, action);

            const element = await this.findElement(action);
            if (!element && action.type !== 'navigate' && action.type !== 'url') {
                console.error('Element not found for action:', action);
                
                if (retryCount < 2) {
                    console.log(`Action failed, waiting and retrying (attempt ${retryCount + 1}/2)`);
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait longer between retries
                    return this.executeAction(action, retryCount + 1);
                }
                
                return false;
            }
            
            // For actions that have a target element, move the cursor to it first
            if (element && action.type !== 'navigate' && action.type !== 'url') {
                // Ensure cursor is properly initialized
                if (!this.cursorElement) {
                    console.log('Reinitializing cursor before action');
                    this.initializeCursor();
                }
                
                // Log element details to help with debugging
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
                        visible: this.isElementVisible(element)
                    });
                }
                
                await this.scrollToElement(element);
                
                // Validate cursor is visible on the page
                if (this.cursorElement) {
                    // Ensure cursor is in the DOM
                    if (!document.body.contains(this.cursorElement)) {
                        console.log('Cursor was removed from DOM, re-appending');
                        document.body.appendChild(this.cursorElement);
                    }
                    
                    // Ensure cursor has display style set to block before animation
                    this.cursorElement.style.display = 'block';
                    
                    // Brief pause to ensure display takes effect
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                
                await this.moveCursorToElement(element);
            }
            
            switch (action.type) {
                case 'click':
                    if (!element) return false;
                    // Element is already scrolled into view and cursor is positioned
                    await this.simulateHumanClick(element);
                    
                    // Add a longer wait after clicking to ensure page updates
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    break;

                case 'input':
                    if (!element || !action.text) return false;
                    // Element is already scrolled into view and cursor is positioned
                    await this.simulateHumanInput(element as HTMLInputElement, action.text);
                    break;

                case 'scroll':
                    if (!element) return false;
                    // Element is already scrolled into view and cursor is positioned
                    // No additional action needed for scroll
                    break;

                case 'navigate':
                case 'url':
                    if (!action.url) return false;
                    console.log(`Navigating to: ${action.url}`);
                    
                    // Show a navigation indicator
                    this.showNavigationFeedback(action.url);
                    
                    // Wait a moment for the feedback to be visible
                    await new Promise(resolve => setTimeout(resolve, 800));
                    
                    // Trigger navigation
                    window.location.href = action.url;
                    
                    // Wait longer for navigation to complete
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    break;

                default:
                    console.error('Unknown action type:', action.type);
                    // Hide cursor for unknown action types
                    this.hideCursor();
                    return false;
            }

            // After action completes, hide the cursor
            this.hideCursor();
            
            console.log(`Action ${action.type} executed successfully`);
            return true;
        } catch (error) {
            console.error('Error executing action:', error);
            
            // Hide cursor if there's an error
            this.hideCursor();
            
            // If we haven't exceeded retries, try again
            if (retryCount < 2) {
                console.log(`Action failed with error, retrying (attempt ${retryCount + 1}/2)`);
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
                
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`Unexpected error in action ${i+1} (${action.type}):`, error);
                results.push(false);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log(`Executed ${actions.length} actions with results:`, results);
        return results;
    }

    /**
     * Shows a visual feedback for navigation
     */
    private showNavigationFeedback(url: string): void {
        if (!this.cursorElement) {
            this.initializeCursor();
        }
        
        if (!this.cursorElement) return;
        
        try {
            // Create a navigation feedback element with logo
            const navFeedback = document.createElement('div');
            navFeedback.style.position = 'fixed';
            navFeedback.style.top = '20%';
            navFeedback.style.left = '50%';
            navFeedback.style.transform = 'translateX(-50%)';
            navFeedback.style.backgroundColor = 'white';
            navFeedback.style.color = '#333';
            navFeedback.style.padding = '15px 20px';
            navFeedback.style.borderRadius = '8px';
            navFeedback.style.fontFamily = 'Arial, sans-serif';
            navFeedback.style.zIndex = '2147483646';
            navFeedback.style.opacity = '0';
            navFeedback.style.transition = 'opacity 0.3s ease';
            navFeedback.style.display = 'flex';
            navFeedback.style.alignItems = 'center';
            navFeedback.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            
            // Add logo
            const logo = document.createElement('img');
            // Get URL for the logo image, falling back to a data URL if chrome isn't available
            if (window.chrome && window.chrome.runtime) {
                logo.src = window.chrome.runtime.getURL('assets/icon/logo.png');
            } else {
                // Fallback to a basic blue circle as a data URL if chrome API isn't available
                logo.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNCIgZmlsbD0id2hpdGUiIHN0cm9rZT0icmdiKDAsIDE1MCwgMjU1KSIgc3Ryb2tlLXdpZHRoPSIyIi8+PHRleHQgeD0iMTEiIHk9IjIwIiBmaWxsPSJyZ2IoMCwgMTUwLCAyNTUpIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtd2VpZ2h0PSJib2xkIiBmb250LXNpemU9IjE0Ij5OPC90ZXh0Pjwvc3ZnPg==';
            }
            logo.style.width = '32px';
            logo.style.height = '32px';
            logo.style.marginRight = '10px';
            navFeedback.appendChild(logo);
            
            // Add text container
            const textContainer = document.createElement('div');
            
            // Add heading
            const heading = document.createElement('div');
            heading.textContent = 'Navigator AI';
            heading.style.fontWeight = 'bold';
            heading.style.marginBottom = '5px';
            textContainer.appendChild(heading);
            
            // Add message
            const message = document.createElement('div');
            message.textContent = `Navigating to: ${this.formatUrl(url)}`;
            textContainer.appendChild(message);
            
            navFeedback.appendChild(textContainer);
            
            document.body.appendChild(navFeedback);
            
            // Display cursor at center of screen
            this.cursorElement.style.transition = 'all 0.5s ease';
            this.cursorElement.style.left = `${window.innerWidth / 2}px`;
            this.cursorElement.style.top = `${window.innerHeight / 2}px`;
            this.cursorElement.style.display = 'block';
            
            // Use filter for orange glow effect
            this.cursorElement.style.filter = 'hue-rotate(30deg) drop-shadow(0 0 5px rgba(255, 140, 0, 0.8))';
            
            // Fade in the navigation message
            setTimeout(() => {
                navFeedback.style.opacity = '1';
            }, 10);
            
            // Animate cursor
            this.cursorElement.animate([
                { transform: 'translate(-50%, -50%) scale(1)' },
                { transform: 'translate(-50%, -50%) scale(1.5)' },
                { transform: 'translate(-50%, -50%) scale(1)' }
            ], {
                duration: 800,
                iterations: 1
            });
            
            // Clean up after a delay
            setTimeout(() => {
                navFeedback.style.opacity = '0';
                setTimeout(() => {
                    if (navFeedback.parentNode) {
                        navFeedback.parentNode.removeChild(navFeedback);
                    }
                }, 300);
            }, 800);
        } catch (error) {
            console.error('Error showing navigation feedback:', error);
        }
    }
    
    /**
     * Format URL for display
     */
    private formatUrl(url: string): string {
        try {
            const urlObj = new URL(url);
            // Just display hostname and truncated pathname
            let path = urlObj.pathname;
            if (path.length > 20) {
                path = path.substring(0, 17) + '...';
            }
            return urlObj.hostname + path;
        } catch (e) {
            // If URL parsing fails, just return the original or truncate it
            return url.length > 30 ? url.substring(0, 27) + '...' : url;
        }
    }
} 