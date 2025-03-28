let sidebarContainer: HTMLElement | null = null;
let isChromeWithSidePanelSupport: boolean = false;

// Check if Chrome's sidePanel API is available
export const isChromeSidePanelSupported = (): boolean => {
        return typeof chrome !== 'undefined' 
            
};

// Initialize on script load
(() => {
    // First check if Chrome's sidePanel API is supported
    isChromeWithSidePanelSupport = isChromeSidePanelSupported();
    console.log('Chrome sidePanel API supported:', isChromeWithSidePanelSupport);
    
    // If not supported initially, wait for up to 5 seconds to see if it becomes available
    if (!isChromeWithSidePanelSupport) {
        console.log('Waiting for Chrome sidePanel API to become available...');
        
        let attempts = 0;
        const maxAttempts = 10; // 10 attempts * 500ms = 5 seconds
        const checkInterval = setInterval(() => {
            attempts++;
            isChromeWithSidePanelSupport = isChromeSidePanelSupported();
            
            if (isChromeWithSidePanelSupport || attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.log('Chrome sidePanel API available after waiting:', isChromeWithSidePanelSupport);
                
                // Initialize sidebar state in storage for Chrome sidePanel users
                if (isChromeWithSidePanelSupport && chrome.storage) {
                    chrome.storage.local.get(['sidePanelState'], (result) => {
                        if (!result.sidePanelState) {
                            // Set default state if not already set
                            chrome.storage.local.set({ sidePanelState: 'closed' });
                        }
                    });
                }
            }
        }, 500);
    } else {
        // Initialize sidebar state in storage for Chrome sidePanel users
        if (chrome.storage) {
            chrome.storage.local.get(['sidePanelState'], (result) => {
                if (!result.sidePanelState) {
                    // Set default state if not already set
                    chrome.storage.local.set({ sidePanelState: 'closed' });
                }
            });
        }
    }
})();

export function createSidebarContainer(): HTMLElement {
    console.log('Creating sidebar container');

    // If Chrome sidePanel is supported, we still create the container for compatibility,
    // but it may not be used directly for rendering
    let container = document.getElementById('navigator-ai-sidebar');
    if (container) {
        console.log('Sidebar container already exists');
        return container;
    }

    container = document.createElement('div');
    container.id = 'navigator-ai-sidebar';

    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.right = '0';
    container.style.width = '0'; // Start with zero width
    container.style.height = '100%';
    container.style.zIndex = '9999999';
    container.style.transition = 'width 0.3s ease';
    container.style.overflow = 'hidden';

    const shadow = container.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
        :host {
            color-scheme: light dark;
        }
        
        iframe {
            width: 100%;
            height: 100%;
            border: none;
            background-color: transparent !important;
        }
        
        .sidebar-open {
            width: 384px !important; /* 96 * 4 = 384px for w-96 in Tailwind */
        }
        
        .sidebar-closed {
            width: 0 !important;
        }
    `;

    const iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('popup.html');
    iframe.style.backgroundColor = 'transparent';
    iframe.style.opacity = '0.98';
    iframe.allow = 'autoplay';

    shadow.appendChild(style);
    shadow.appendChild(iframe);

    document.body.appendChild(container);

    sidebarContainer = container;

    return container;
}

export function updateSidebarState(isOpen: boolean): void {
    console.log('Updating sidebar state:', isOpen);

    if (isChromeWithSidePanelSupport) {
        // Use Chrome's sidePanel API
        if (isOpen) {
            chrome.runtime.sendMessage({ type: 'openSidePanel' });
            // Store state in Chrome storage
            chrome.storage.local.set({ sidePanelState: 'open' });
        } else {
            chrome.runtime.sendMessage({ type: 'closeSidePanel' });
            // Store state in Chrome storage
            chrome.storage.local.set({ sidePanelState: 'closed' });
        }
        return;
    }

    // Fallback to custom implementation for non-Chrome browsers
    if (!sidebarContainer) {
        sidebarContainer = createSidebarContainer();
    }

    // Store state in Chrome storage (using sidebarOpen for non-Chrome browsers)
    chrome.storage.local.set({ sidebarOpen: isOpen });

    if (isOpen) {
        sidebarContainer.style.width = '384px'; // w-96 in Tailwind
        sidebarContainer.classList.add('sidebar-open');
        sidebarContainer.classList.remove('sidebar-closed');
    } else {
        sidebarContainer.style.width = '0';
        sidebarContainer.classList.add('sidebar-closed');
        sidebarContainer.classList.remove('sidebar-open');
    }
}

export function toggleSidebar(): boolean {
    console.log('Toggling sidebar');

    if (isChromeWithSidePanelSupport) {
        // For Chrome, we'll toggle via background script
        chrome.storage.local.get(['sidePanelState'], (result) => {
            const currentState = result.sidePanelState || 'closed';
            const newState = currentState === 'open' ? 'closed' : 'open';
            
            chrome.runtime.sendMessage({ type: 'toggleSidePanel' }, (response) => {
                console.log('Toggled Chrome side panel:', response);
            });
            
            // Update local state for components that might be checking it
            chrome.storage.local.set({ sidePanelState: newState });
        });
        
        // Return true to indicate the action was handled
        return true;
    }

    // Fallback to custom implementation for non-Chrome browsers
    if (!sidebarContainer) {
        sidebarContainer = createSidebarContainer();
    }

    const isCurrentlyOpen = sidebarContainer.classList.contains('sidebar-open');
    updateSidebarState(!isCurrentlyOpen);
    
    // Store state in local storage for consistency
    chrome.storage.local.set({ sidebarOpen: !isCurrentlyOpen });

    return !isCurrentlyOpen;
}

/**
 * Get the current sidebar state from storage.
 * @param callback Callback function receiving the current state (true = open, false = closed)
 */
export function getSidebarState(callback: (isOpen: boolean) => void): void {
    if (isChromeWithSidePanelSupport) {
        // For Chrome's native sidePanel, check the sidePanelState
        chrome.storage.local.get(['sidePanelState'], (result) => {
            callback(result.sidePanelState === 'open');
        });
    } else {
        // For custom sidebar, check the sidebarOpen flag
        chrome.storage.local.get(['sidebarOpen'], (result) => {
            callback(!!result.sidebarOpen);
        });
    }
} 