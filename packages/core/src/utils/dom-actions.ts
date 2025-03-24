export class DomActions {
    private debugMode = false;

    constructor(options?: { debug?: boolean }) {
        this.debugMode = options?.debug ?? false;
    }

    public setDebugMode(enable: boolean): void {
        this.debugMode = enable;
    }

    public async simulateHumanClick(element: Element): Promise<void> {
        const rect = element.getBoundingClientRect();
        const centerX = Math.floor(rect.left + rect.width / 2);
        const centerY = Math.floor(rect.top + rect.height / 2);

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

        await new Promise(resolve => setTimeout(resolve, 300));
    }

    public async simulateHumanInput(element: HTMLInputElement, text: string, shouldPressEnter = true): Promise<void> {
        // Focus the input element first
        element.focus();

        // Clear existing value if any
        element.value = '';

        // Type characters with human-like delays
        for (let i = 0; i < text.length; i++) {
            const char = text.charAt(i);

            // Add character to input
            element.value += char;

            // Create and dispatch input event
            element.dispatchEvent(new Event('input', { bubbles: true }));

            // Generate keydown and keyup events with the correct key code
            const keyCode = char.charCodeAt(0);

            // KeyDown event
            element.dispatchEvent(new KeyboardEvent('keydown', {
                key: char,
                code: `Key${char.toUpperCase()}`,
                keyCode: keyCode,
                which: keyCode,
                bubbles: true,
                cancelable: true
            }));

            // KeyPress event
            element.dispatchEvent(new KeyboardEvent('keypress', {
                key: char,
                code: `Key${char.toUpperCase()}`,
                keyCode: keyCode,
                which: keyCode,
                bubbles: true,
                cancelable: true
            }));

            // KeyUp event
            element.dispatchEvent(new KeyboardEvent('keyup', {
                key: char,
                code: `Key${char.toUpperCase()}`,
                keyCode: keyCode,
                which: keyCode,
                bubbles: true,
                cancelable: true
            }));

            // Random typing speed delay between 30-100ms
            const typingDelay = Math.floor(Math.random() * 70) + 30;
            await new Promise(resolve => setTimeout(resolve, typingDelay));

            // Occasionally add a longer pause (1 in 8 chance)
            if (Math.random() < 0.125 && i < text.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 200));
            }
        }

        // Trigger change event after completion
        element.dispatchEvent(new Event('change', { bubbles: true }));

        // If requested, simulate pressing Enter key
        if (shouldPressEnter) {
            await this.simulateEnterKey(element);
        }

        // Small delay after typing completes
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    public async simulateEnterKey(element: Element): Promise<void> {
        // KeyDown event for Enter
        element.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
        }));

        // KeyPress event for Enter
        element.dispatchEvent(new KeyboardEvent('keypress', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
        }));

        // Determine if this should trigger a form submission
        let formToSubmit: HTMLFormElement | null = null;
        if (element instanceof HTMLInputElement && element.form) {
            formToSubmit = element.form;
        } else if (element.closest('form')) {
            formToSubmit = element.closest('form') as HTMLFormElement;
        }

        // If inside a form, try to submit it
        if (formToSubmit) {
            formToSubmit.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

            // If form has submit button, click it
            const submitButton = formToSubmit.querySelector('input[type="submit"], button[type="submit"]');
            if (submitButton) {
                submitButton.dispatchEvent(new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                }));
            }
        }

        // KeyUp event for Enter
        element.dispatchEvent(new KeyboardEvent('keyup', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
        }));

        // Small delay after pressing Enter
        await new Promise(resolve => setTimeout(resolve, 200));
    }
} 