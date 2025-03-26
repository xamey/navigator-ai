export class CursorManager {
    cursorElement: HTMLImageElement | null = null;
    debugMode = false;
    cursorSize = 32;
    cursorUI = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNCIgZmlsbD0icmdiYSg3NSwgMjAwLCAyNTUsIDAuNSkiIHN0cm9rZT0icmdiKDAsIDE1MCwgMjU1KSIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+';

    constructor(options?: { debug?: boolean, cursorSize?: number, cursorUI?: string }) {
        this.debugMode = options?.debug ?? false;
        this.cursorSize = options?.cursorSize ?? 32;
        this.cursorUI = options?.cursorUI ?? 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNCIgZmlsbD0icmdiYSg3NSwgMjAwLCAyNTUsIDAuNSkiIHN0cm9rZT0icmdiKDAsIDE1MCwgMjU1KSIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+';  
        this.initializeCursor();
    }

    public setDebugMode(enable: boolean): void {
        this.debugMode = enable;

        if (typeof window !== 'undefined') {
            const existingOverlay = document.getElementById('navigator-ai-debug');
            if (enable && !existingOverlay) {
                const debugOverlay = document.createElement('div');
                debugOverlay.id = 'navigator-ai-debug';
                debugOverlay.style.position = 'fixed';
                debugOverlay.style.bottom = '10px';
                debugOverlay.style.right = '10px';
                debugOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                debugOverlay.style.color = 'white';
                debugOverlay.style.padding = '5px 10px';
                debugOverlay.style.borderRadius = '5px';
                debugOverlay.style.fontFamily = 'monospace';
                debugOverlay.style.fontSize = '12px';
                debugOverlay.style.zIndex = '2147483646';
                debugOverlay.textContent = 'Navigator AI Debug: ON';
                document.body.appendChild(debugOverlay);
            } else if (!enable && existingOverlay && existingOverlay.parentNode) {
                existingOverlay.parentNode.removeChild(existingOverlay);
            }
        }
    }

    public setCursorSize(size: number): void {
        this.cursorSize = size;

        if (this.cursorElement) {
            this.cursorElement.style.width = `${size}px`;
            this.cursorElement.style.height = `${size}px`;
        }
    }

    public ensureCursorVisible(): void {
        if (!this.cursorElement) {
            this.initializeCursor();
        }

        if (this.cursorElement) {
            if (!document.body.contains(this.cursorElement)) {
                document.body.appendChild(this.cursorElement);
            }

            this.cursorElement.style.transition = 'none';
            this.cursorElement.style.left = `${window.innerWidth / 2}px`;
            this.cursorElement.style.top = `${window.innerHeight / 2}px`;
            this.cursorElement.style.display = 'block';
            this.cursorElement.style.opacity = '1';

            this.cursorElement.style.width = `${this.cursorSize * 1.5}px`;
            this.cursorElement.style.height = `${this.cursorSize * 1.5}px`;

            this.cursorElement.animate([
                { transform: 'translate(-50%, -50%) scale(1)', filter: 'brightness(1)' },
                { transform: 'translate(-50%, -50%) scale(2)', filter: 'brightness(1.5)' },
                { transform: 'translate(-50%, -50%) scale(1)', filter: 'brightness(1)' }
            ], {
                duration: 800,
                iterations: 2
            });

            setTimeout(() => {
                if (this.cursorElement) {
                    this.cursorElement.style.width = `${this.cursorSize}px`;
                    this.cursorElement.style.height = `${this.cursorSize}px`;
                }
            }, 1600);
        }
    }

    public initializeCursor(): void {
        if (typeof document === 'undefined') return;

        try {
            const existingCursor = document.getElementById('navigator-ai-cursor');
            if (existingCursor && existingCursor.parentNode) {
                existingCursor.parentNode.removeChild(existingCursor);
            }

            this.cursorElement = document.createElement('img');
            this.cursorElement.id = 'navigator-ai-cursor';

            // if (window.chrome && window.chrome.runtime) {
            //     this.cursorElement.src = window.chrome.runtime.getURL('assets/icon/cursor.png');
            // } else {
            // }
            this.cursorElement.src = this.cursorUI
            this.cursorElement.style.position = 'fixed';
            this.cursorElement.style.width = `${this.cursorSize}px`;
            this.cursorElement.style.height = `${this.cursorSize}px`;
            this.cursorElement.style.pointerEvents = 'none';
            this.cursorElement.style.zIndex = '2147483647';
            this.cursorElement.style.transform = 'translate(-50%, -50%)';
            this.cursorElement.style.transition = 'all 0.3s ease-out';
            this.cursorElement.style.display = 'none';
            this.cursorElement.style.filter = 'drop-shadow(0 0 5px rgba(0, 150, 255, 0.8))';
            this.cursorElement.style.willChange = 'transform, left, top';

            document.body.appendChild(this.cursorElement);

            if (this.debugMode) {
                const debugOverlay = document.createElement('div');
                debugOverlay.id = 'navigator-ai-debug';
                debugOverlay.style.position = 'fixed';
                debugOverlay.style.bottom = '10px';
                debugOverlay.style.right = '10px';
                debugOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                debugOverlay.style.color = 'white';
                debugOverlay.style.padding = '3px 6px';
                debugOverlay.style.borderRadius = '3px';
                debugOverlay.style.fontFamily = 'monospace';
                debugOverlay.style.fontSize = '12px';
                debugOverlay.style.zIndex = '2147483646';
                debugOverlay.textContent = 'Navigator AI Debug: ON';
                document.body.appendChild(debugOverlay);
            }
        } catch (error) {
            console.error('Failed to initialize cursor:', error);
        }
    }

    public async moveCursorToElement(element: Element): Promise<void> {
        if (!this.cursorElement) {
            this.initializeCursor();
        }

        if (!this.cursorElement) return;

        try {
            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            this.cursorElement.style.display = 'block';

            this.cursorElement.style.transition = 'none';
            this.cursorElement.style.left = `${window.innerWidth / 2}px`;
            this.cursorElement.style.top = `${window.innerHeight / 2}px`;

            void this.cursorElement.offsetWidth;

            this.cursorElement.style.transition = 'all 0.5s cubic-bezier(0.19, 1, 0.22, 1)';
            this.cursorElement.style.left = `${centerX}px`;
            this.cursorElement.style.top = `${centerY}px`;

            this.cursorElement.animate([
                { transform: 'translate(-50%, -50%) scale(0.8)', opacity: 0.7 },
                { transform: 'translate(-50%, -50%) scale(1.2)', opacity: 1 },
                { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.9 }
            ], {
                duration: 600,
                iterations: 1
            });

            await new Promise(resolve => setTimeout(resolve, 600));
        } catch (error) {
            console.error('Error moving cursor to element:', error);
        }
    }

    public hideCursor(): void {
        if (!this.cursorElement) return;

        try {
            this.cursorElement.animate([
                { opacity: 1 },
                { opacity: 0 }
            ], {
                duration: 300,
                easing: 'ease-out',
                fill: 'forwards'
            });

            setTimeout(() => {
                if (this.cursorElement) {
                    this.cursorElement.style.display = 'none';
                    this.cursorElement.style.opacity = '1';
                }
            }, 300);
        } catch (error) {
            if (this.debugMode) {
                console.error('Error hiding cursor with animation:', error);
            }
            this.cursorElement.style.display = 'none';
        }
    }

    public showNavigationFeedback(url: string): void {
        if (!this.cursorElement) {
            this.initializeCursor();
        }

        if (!this.cursorElement) return;

        try {
            const navFeedback = document.createElement('div');
            navFeedback.style.position = 'fixed';
            navFeedback.style.top = '20%';
            navFeedback.style.left = '50%';
            navFeedback.style.transform = 'translateX(-50%)';
            navFeedback.style.backgroundColor = 'white';
            navFeedback.style.color = '#333';
            navFeedback.style.padding = '15px 20px';
            navFeedback.style.borderRadius = '8px';
            navFeedback.style.fontFamily = 'Arial, sans-serif';
            navFeedback.style.zIndex = '2147483646';
            navFeedback.style.opacity = '0';
            navFeedback.style.transition = 'opacity 0.3s ease';
            navFeedback.style.display = 'flex';
            navFeedback.style.alignItems = 'center';
            navFeedback.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';

            const logo = document.createElement('img')  ;
            logo.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNCIgZmlsbD0id2hpdGUiIHN0cm9rZT0icmdiKDAsIDE1MCwgMjU1KSIgc3Ryb2tlLXdpZHRoPSIyIi8+PHRleHQgeD0iMTEiIHk9IjIwIiBmaWxsPSJyZ2IoMCwgMTUwLCAyNTUpIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtd2VpZ2h0PSJib2xkIiBmb250LXNpemU9IjE0Ij5OPC90ZXh0Pjwvc3ZnPg==';
            logo.style.width = '32px';
            logo.style.height = '32px';
            logo.style.marginRight = '10px';
            logo.style.width = '32px';
            logo.style.height = '32px';
            logo.style.marginRight = '10px';
            navFeedback.appendChild(logo);

            const textContainer = document.createElement('div');

            const heading = document.createElement('div');
            heading.textContent = 'Navigator AI';
            heading.style.fontWeight = 'bold';
            heading.style.marginBottom = '5px';
            textContainer.appendChild(heading);

            const message = document.createElement('div');
            message.textContent = `Navigating to: ${this.formatUrl(url)}`;
            textContainer.appendChild(message);

            navFeedback.appendChild(textContainer);

            document.body.appendChild(navFeedback);

            this.cursorElement.style.transition = 'all 0.5s ease';
            this.cursorElement.style.left = `${window.innerWidth / 2}px`;
            this.cursorElement.style.top = `${window.innerHeight / 2}px`;
            this.cursorElement.style.display = 'block';

            this.cursorElement.style.filter = 'hue-rotate(30deg) drop-shadow(0 0 5px rgba(255, 140, 0, 0.8))';

            setTimeout(() => {
                navFeedback.style.opacity = '1';
            }, 10);

            this.cursorElement.animate([
                { transform: 'translate(-50%, -50%) scale(1)' },
                { transform: 'translate(-50%, -50%) scale(1.5)' },
                { transform: 'translate(-50%, -50%) scale(1)' }
            ], {
                duration: 800,
                iterations: 1
            });

            setTimeout(() => {
                navFeedback.style.opacity = '0';
                setTimeout(() => {
                    if (navFeedback.parentNode) {
                        navFeedback.parentNode.removeChild(navFeedback);
                    }
                }, 300);
            }, 800);
        } catch (error) {
            console.error('Error showing navigation feedback:', error);
        }
    }

    private formatUrl(url: string): string {
        try {
            const urlObj = new URL(url);
            let path = urlObj.pathname;
            if (path.length > 20) {
                path = path.substring(0, 17) + '...';
            }
            return urlObj.hostname + path;
        } catch (e) {
            return url.length > 30 ? url.substring(0, 27) + '...' : url;
        }
    }
} 