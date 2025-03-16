import { createSidebarContainer, isChromeSidePanelSupported } from './sidebar';
import { initializeMessageListener } from './messaging';

console.log('Content script loaded');

// Only create the custom sidebar container if Chrome's sidePanel API is not available
if (!isChromeSidePanelSupported()) {
    console.log('Creating custom sidebar container (Chrome sidePanel API not available)');
    createSidebarContainer();
} else {
    console.log('Using Chrome sidePanel API instead of custom sidebar');
}

initializeMessageListener();