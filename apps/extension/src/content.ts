import { createSidebarContainer } from './sidebar';
import { initializeMessageListener } from './messaging';

console.log('Content script loaded');

console.log('Creating sidebar container on content script load');
createSidebarContainer();

initializeMessageListener();