let sidebarContainer: HTMLElement | null = null;
let isChromeWithSidePanelSupport: boolean = false;

// Check if Chrome's sidePanel API is available
export const isChromeSidePanelSupported = (): boolean => {
    return !!chrome.sidePanel && typeof chrome.sidePanel.open === 'function';
};

// Initialize on script load
(() => {
    isChromeWithSidePanelSupport = isChromeSidePanelSupported();
    console.log('Chrome sidePanel API supported:', isChromeWithSidePanelSupport);
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
        } else {
            chrome.runtime.sendMessage({ type: 'closeSidePanel' });
        }
        return;
    }

    // Fallback to custom implementation for non-Chrome browsers
    if (!sidebarContainer) {
        sidebarContainer = createSidebarContainer();
    }

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
        chrome.runtime.sendMessage({ type: 'toggleSidePanel' }, (response) => {
            console.log('Toggled Chrome side panel:', response);
        });
        
        // We don't know the current state immediately, so just return true
        // The actual state will be managed by Chrome's sidePanel API
        return true;
    }

    // Fallback to custom implementation
    if (!sidebarContainer) {
        sidebarContainer = createSidebarContainer();
    }

    const isCurrentlyOpen = sidebarContainer.classList.contains('sidebar-open');
    updateSidebarState(!isCurrentlyOpen);

    return !isCurrentlyOpen;
} 