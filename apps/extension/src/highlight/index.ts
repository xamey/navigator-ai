import { DOMElementNode, DOMHashMap, DOMNode } from '@navigator-ai/core';
import { getElementByXPathIncludingIframes } from '../utils';

const colors = [
    "rgba(66, 133, 244, 0.7)",   
    "rgba(234, 67, 53, 0.7)",    
    "rgba(52, 168, 83, 0.7)",    
    "rgba(251, 188, 5, 0.7)",    
    "rgba(149, 117, 205, 0.7)",  
    "rgba(59, 178, 208, 0.7)",   
    "rgba(240, 98, 146, 0.7)",   
    "rgba(255, 145, 0, 0.7)",    
]; 

export function highlightInteractiveElements(domStructure: DOMHashMap): void {
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

    interactiveElements.forEach((element: DOMNode, index: number) => {
        const xpath = (element as DOMElementNode).xpath;
        try {
            let highlightedElement = getElementByXPathIncludingIframes(xpath);
            
            if (!highlightedElement) {
                highlightedElement = document.evaluate(
                    xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
                ).singleNodeValue as HTMLElement;
            }
            
            if (highlightedElement && highlightedElement instanceof HTMLElement) {
                let parentDocument = document;
                let isInIframe = false;
                
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
                
                if (isInIframe) {
                    try {
                        let styleEl = parentDocument.getElementById('navigator-ai-highlight-style');
                        if (!styleEl) {
                            styleEl = parentDocument.createElement('style');
                            styleEl.id = 'navigator-ai-highlight-style';
                            parentDocument.head.appendChild(styleEl);
                        }
                        
                        const color = colors[index % colors.length];
                        styleEl.textContent += `
                            .navigator-ai-highlight-${index} {
                                outline: 2px solid ${color} !important;
                                outline-offset: 2px !important;
                            }
                        `;
                        
                        highlightedElement.classList.add(`navigator-ai-highlight-${index}`);
                        highlightedElement.classList.add('navigator-ai-highlight');
                    } catch (styleError) {
                        console.error('Error applying iframe styles:', styleError);
                    }
                } else {
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

export function clearAllHighlights(): void {
    const highlightedElements = document.querySelectorAll('.navigator-ai-highlight');
    highlightedElements.forEach((el) => {
        if (el instanceof HTMLElement) {
            el.style.outline = '';
            el.style.outlineOffset = '';
            el.className = el.className
                .split(' ')
                .filter(c => !c.startsWith('navigator-ai-highlight'))
                .join(' ');
        }
    });
    
    try {
        const iframes = document.querySelectorAll('iframe');
        for (let i = 0; i < iframes.length; i++) {
            const iframe = iframes[i];
            
            if (!iframe.contentDocument || iframe.src.startsWith('chrome-extension://')) {
                continue;
            }
            
            try {
                const iframeHighlights = iframe.contentDocument.querySelectorAll('.navigator-ai-highlight');
                iframeHighlights.forEach((el) => {
                    if (el instanceof HTMLElement) {
                        el.style.outline = '';
                        el.style.outlineOffset = '';
                        el.className = el.className
                            .split(' ')
                            .filter(c => !c.startsWith('navigator-ai-highlight'))
                            .join(' ');
                    }
                });
                
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