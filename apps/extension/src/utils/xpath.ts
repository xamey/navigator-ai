// utils/xpath.ts
// Utility functions for working with XPath

/**
 * Gets an element by XPath, including searching in iframes
 * @param xpath The XPath expression
 * @returns The element if found, or null
 */
export function getElementByXPathIncludingIframes(xpath: string): HTMLElement | null {
    try {
        // First try to find the element in the main document
        const result = document.evaluate(
            xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
        );
        const element = result.singleNodeValue as HTMLElement;
        
        if (element) {
            return element;
        }
        
        // If not found, check if it's in an iframe
        // Look for navigator-iframe-data tags in the DOM xpath which might indicate
        // the element is inside an iframe
        const iframePathMatch = xpath.match(/\/navigator-iframe-data\[@data-iframe-id="([^"]+)"\]/);
        
        if (iframePathMatch) {
            const iframeId = iframePathMatch[1];
            const iframeElement = document.querySelector(`iframe[data-navigator-iframe-id="${iframeId}"]`);
            
            if (iframeElement && iframeElement instanceof HTMLIFrameElement) {
                try {
                    // Extract the part of xpath after the navigator-iframe-data part
                    const remainingXpath = xpath.substring(xpath.indexOf(iframePathMatch[0]) + iframePathMatch[0].length);
                    
                    // Try to evaluate this xpath in the iframe content document
                    if (iframeElement.contentDocument) {
                        const iframeResult = iframeElement.contentDocument.evaluate(
                            remainingXpath, iframeElement.contentDocument, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
                        );
                        return iframeResult.singleNodeValue as HTMLElement;
                    }
                } catch (error) {
                    console.error('Error evaluating XPath in iframe:', error);
                }
            }
        }
        
        // If we still haven't found it, try searching in all accessible iframes
        const iframes = document.querySelectorAll('iframe');
        for (let i = 0; i < iframes.length; i++) {
            const iframe = iframes[i];
            if (iframe.contentDocument) {
                try {
                    const iframeResult = iframe.contentDocument.evaluate(
                        xpath, iframe.contentDocument, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
                    );
                    const iframeElement = iframeResult.singleNodeValue as HTMLElement;
                    if (iframeElement) {
                        return iframeElement;
                    }
                } catch {
                    // Silently continue to the next iframe
                }
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error finding element by XPath:', error);
        return null;
    }
} 