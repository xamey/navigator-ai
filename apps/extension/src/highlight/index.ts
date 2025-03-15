// highlight/index.ts
// Functions for highlighting elements in the DOM

import { DOMElementNode, DOMHashMap, DOMNode } from '@navigator-ai/core';
import { getElementByXPathIncludingIframes } from '../utils';

// Colors for highlighting different elements
const colors = [
    "#FF0000", "#00FF00", "#0000FF", "#FFA500",
    "#800080", "#008080", "#FF69B4", "#4B0082",
    "#FF4500", "#2E8B57", "#DC143C", "#4682B4",
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
                        
                        // Add the highlight class style
                        const color = colors[index % colors.length];
                        styleEl.textContent += `
                            .navigator-ai-highlight-${index} {
                                outline: 2px solid ${color} !important;
                                outline-offset: 2px !important;
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
                    highlightedElement.style.outline = `2px solid ${colors[index % colors.length]}`;
                    highlightedElement.style.outlineOffset = '2px';
                    highlightedElement.classList.add('navigator-ai-highlight');
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