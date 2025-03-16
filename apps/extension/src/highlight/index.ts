// highlight/index.ts
// Functions for highlighting elements in the DOM

import { DOMElementNode, DOMHashMap, DOMNode } from '@navigator-ai/core';
import { getElementByXPathIncludingIframes } from '../utils';

// Colors for highlighting different elements - modern, semi-transparent colors with good contrast
const colors = [
    "rgba(66, 133, 244, 0.7)",   // Google Blue
    "rgba(234, 67, 53, 0.7)",    // Google Red
    "rgba(52, 168, 83, 0.7)",    // Google Green
    "rgba(251, 188, 5, 0.7)",    // Google Yellow
    "rgba(149, 117, 205, 0.7)",  // Purple
    "rgba(59, 178, 208, 0.7)",   // Teal
    "rgba(240, 98, 146, 0.7)",   // Pink
    "rgba(255, 145, 0, 0.7)",    // Orange
];

/**
 * Highlight interactive elements in the DOM
 * @param domStructure The DOM structure from the parser
 */
export function highlightInteractiveElements(domStructure: DOMHashMap): void {
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
            // First try to get the element using our iframe-aware function
            let highlightedElement = getElementByXPathIncludingIframes(xpath);
            
            // If that fails, try the standard approach
            if (!highlightedElement) {
                highlightedElement = document.evaluate(
                    xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
                ).singleNodeValue as HTMLElement;
            }
            
            if (highlightedElement && highlightedElement instanceof HTMLElement) {
                // Check if element is in an iframe
                let parentDocument = document;
                let isInIframe = false;
                
                // Find which document this element belongs to
                try {
                    const iframes = document.querySelectorAll('iframe');
                    for (let i = 0; i < iframes.length; i++) {
                        const iframe = iframes[i];
                        if (iframe.contentDocument && iframe.contentDocument.contains(highlightedElement)) {
                            parentDocument = iframe.contentDocument;
                            isInIframe = true;
                            break;
                        }
                    }
                } catch (frameError) {
                    console.error('Error finding parent frame:', frameError);
                }
                
                // Apply highlighting appropriately based on whether it's in an iframe
                if (isInIframe) {
                    // For iframe elements, we need to inject a style and apply the highlight via class
                    try {
                        // Create a style element in the iframe if it doesn't exist
                        let styleEl = parentDocument.getElementById('navigator-ai-highlight-style');
                        if (!styleEl) {
                            styleEl = parentDocument.createElement('style');
                            styleEl.id = 'navigator-ai-highlight-style';
                            parentDocument.head.appendChild(styleEl);
                        }
                        
                        // Add the highlight class style with improved styling
                        const color = colors[index % colors.length];
                        styleEl.textContent += `
                            .navigator-ai-highlight-${index} {
                                outline: 3px solid ${color} !important;
                                outline-offset: 3px !important;
                                box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3) !important;
                                transition: outline 0.2s ease-in-out !important;
                            }
                            .navigator-ai-highlight-${index}:hover {
                                outline-width: 4px !important;
                            }
                        `;
                        
                        // Apply the class
                        highlightedElement.classList.add(`navigator-ai-highlight-${index}`);
                        highlightedElement.classList.add('navigator-ai-highlight');
                    } catch (styleError) {
                        console.error('Error applying iframe styles:', styleError);
                    }
                } else {
                    // For regular document elements, apply style directly
                    const color = colors[index % colors.length];
                    highlightedElement.style.outline = `3px solid ${color}`;
                    highlightedElement.style.outlineOffset = '3px';
                    highlightedElement.style.boxShadow = '0 0 0 1px rgba(255, 255, 255, 0.3)';
                    highlightedElement.style.transition = 'outline 0.2s ease-in-out';
                    highlightedElement.classList.add('navigator-ai-highlight');
                    
                    // Add hover effect with event listeners
                    highlightedElement.addEventListener('mouseenter', () => {
                        highlightedElement.style.outlineWidth = '4px';
                    });
                    highlightedElement.addEventListener('mouseleave', () => {
                        highlightedElement.style.outlineWidth = '3px';
                    });
                }
            }
        } catch (error) {
            console.error('Error highlighting element:', error);
        }
    });
}

/**
 * Clear all element highlights
 */
export function clearAllHighlights(): void {
    // Clear highlights in the main document
    const highlightedElements = document.querySelectorAll('.navigator-ai-highlight');
    highlightedElements.forEach((el) => {
        if (el instanceof HTMLElement) {
            el.style.outline = '';
            el.style.outlineOffset = '';
            el.style.boxShadow = '';
            el.style.transition = '';
            
            // Remove event listeners (using clone technique to ensure all are removed)
            const clone = el.cloneNode(true);
            if (el.parentNode) {
                el.parentNode.replaceChild(clone, el);
            }
            
            // Remove all navigator-ai-highlight classes
            el.className = el.className
                .split(' ')
                .filter(c => !c.startsWith('navigator-ai-highlight'))
                .join(' ');
        }
    });
    
    // Also clear highlights in all accessible iframes
    try {
        const iframes = document.querySelectorAll('iframe');
        for (let i = 0; i < iframes.length; i++) {
            const iframe = iframes[i];
            
            // Skip iframes that can't be accessed
            if (!iframe.contentDocument || iframe.src.startsWith('chrome-extension://')) {
                continue;
            }
            
            try {
                // Clear highlighted elements in this iframe
                const iframeHighlights = iframe.contentDocument.querySelectorAll('.navigator-ai-highlight');
                iframeHighlights.forEach((el) => {
                    if (el instanceof HTMLElement) {
                        el.style.outline = '';
                        el.style.outlineOffset = '';
                        el.style.boxShadow = '';
                        el.style.transition = '';
                        
                        // Remove event listeners (using clone technique to ensure all are removed)
                        const clone = el.cloneNode(true);
                        if (el.parentNode) {
                            el.parentNode.replaceChild(clone, el);
                        }
                        
                        // Remove all navigator-ai-highlight classes
                        el.className = el.className
                            .split(' ')
                            .filter(c => !c.startsWith('navigator-ai-highlight'))
                            .join(' ');
                    }
                });
                
                // Remove the highlight style element if it exists
                const styleEl = iframe.contentDocument.getElementById('navigator-ai-highlight-style');
                if (styleEl) {
                    styleEl.parentNode?.removeChild(styleEl);
                }
            } catch (iframeError) {
                console.error(`Error clearing highlights in iframe ${i}:`, iframeError);
            }
        }
    } catch (error) {
        console.error('Error clearing highlights in iframes:', error);
    }
} 