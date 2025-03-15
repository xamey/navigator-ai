export async function captureIframeContents(originalHtml: string): Promise<string> {
    try {
        console.log('Capturing iframe contents...');
        
        const iframes = document.querySelectorAll('iframe');
        
        if (iframes.length === 0) {
            console.log('No iframes found on the page');
            return originalHtml;
        }
        
        console.log(`Found ${iframes.length} iframes on the page`);
        let processedHtml = originalHtml;
        
        const iframeContents: string[] = [];
        
        for (let i = 0; i < iframes.length; i++) {
            try {
                const iframe = iframes[i];
                
                if (!iframe.contentDocument || !iframe.contentWindow || 
                    iframe.src.startsWith('chrome-extension://')) {
                    console.log(`Skipping iframe ${i} - cannot access content or is extension iframe`);
                    continue;
                }
                
                let iframeContent: string;
                try {
                    const iframeDoc = iframe.contentDocument;
                    
                    const baseContent = iframeDoc.documentElement.outerHTML;
                    
                    const nestedIframes = iframeDoc.querySelectorAll('iframe');
                    if (nestedIframes.length > 0) {
                        console.log(`Found ${nestedIframes.length} nested iframes in iframe ${i}`);
                        iframeContent = await captureIframeContents(baseContent);
                    } else {
                        iframeContent = baseContent;
                    }
                } catch (err) {
                    console.log(`Cannot access iframe ${i} content due to cross-origin restrictions:`, err);
                    continue;
                }
                
                const iframeId = `iframe-content-${i}`;
                
                const iframeAttrs: string[] = [];
                if (iframe.id) iframeAttrs.push(`id="${iframe.id}"`);
                if (iframe.className) iframeAttrs.push(`class="${iframe.className}"`);
                if (iframe.src) iframeAttrs.push(`src="${iframe.src}"`);
                if (iframe.name) iframeAttrs.push(`name="${iframe.name}"`);
                
                const iframeXPath = getXPathForElement(iframe);
                if (iframeXPath) iframeAttrs.push(`xpath="${iframeXPath}"`);
                
                const iframeDataTag = `<navigator-iframe-data ${iframeAttrs.join(' ')} data-iframe-id="${iframeId}">\n${iframeContent}\n</navigator-iframe-data>`;
                iframeContents.push(iframeDataTag);
                
                try {
                    const domPosition = findIframePositionInHTML(processedHtml, iframe);
                    if (domPosition > -1) {
                        const beforeIframe = processedHtml.substring(0, domPosition);
                        const afterIframe = processedHtml.substring(domPosition);
                        
                        const newAfterIframe = afterIframe.replace(
                            /(<iframe\s)/i, 
                            `$1data-navigator-iframe-id="${iframeId}" `
                        );
                        
                        processedHtml = beforeIframe + newAfterIframe;
                    }
                } catch (markError) {
                    console.error('Error marking iframe in HTML:', markError);
                }
            } catch (error) {
                console.error(`Error processing iframe ${i}:`, error);
            }
        }
        
        if (iframeContents.length > 0) {
            processedHtml += `\n<!-- Navigator AI Iframe Contents -->\n<navigator-iframes>\n${iframeContents.join('\n')}\n</navigator-iframes>`;
            console.log(`Added content from ${iframeContents.length} iframes to the DOM`);
        }
        
        return processedHtml;
    } catch (error) {
        console.error('Error capturing iframe contents:', error);
        return originalHtml;
    }
}

export function getXPathForElement(element: Element): string | null {
    try {
        if (element === document.documentElement) {
            return '/html';
        }
        
        if (element === document.body) {
            return '/html/body';
        }
        
        let xpath = '';
        let current = element;
        
        while (current && current !== document.documentElement) {
            const nodeName = current.nodeName.toLowerCase();
            let position = 1;
            let sibling = current.previousSibling;
            
            while (sibling) {
                if (sibling.nodeType === Node.ELEMENT_NODE && 
                    sibling.nodeName.toLowerCase() === nodeName) {
                    position++;
                }
                sibling = sibling.previousSibling;
            }
            
            xpath = `/${nodeName}[${position}]${xpath}`;
            
            if (current.parentNode) {
                current = current.parentNode as Element;
            } else {
                break;
            }
        }
        
        return `/html${xpath}`;
    } catch (error) {
        console.error('Error generating XPath:', error);
        return null;
    }
}


export function findIframePositionInHTML(html: string, iframe: HTMLIFrameElement): number {
    try {
        const attributes: [string, string][] = [];
        
        if (iframe.id) attributes.push(['id', iframe.id]);
        if (iframe.className) attributes.push(['class', iframe.className]);
        if (iframe.src) attributes.push(['src', iframe.src]);
        if (iframe.name) attributes.push(['name', iframe.name]);
        
        for (const [attr, value] of attributes) {
            const searchStr = `<iframe ${attr}="${value}"`;
            const altSearchStr = `<iframe ${attr}='${value}'`;
            
            let pos = html.indexOf(searchStr);
            if (pos > -1) return pos;
            
            pos = html.indexOf(altSearchStr);
            if (pos > -1) return pos;
        }
        
        return html.indexOf('<iframe');
    } catch (error) {
        console.error('Error finding iframe position:', error);
        return -1;
    }
} 