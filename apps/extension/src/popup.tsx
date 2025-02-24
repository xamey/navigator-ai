import { useEffect, useState } from 'react';
import type { Message, TaskState } from './types';

export default function Popup() {
    const [state, setState] = useState<TaskState>({
        taskId: null,
        status: 'idle',
        task: '',
        isRunning: false,
        iterations: 0
    });
    const [isMinimized, setIsMinimized] = useState(false);

    useEffect(() => {
        console.log('Popup component mounted');

        // Add message listener for iteration updates
        const messageListener = (message: Message) => {
            if (message.type === 'iterationUpdate') {
                setState(prev => ({
                    ...prev,
                    iterations: message.iterations || prev.iterations
                }));
            }
        };

        chrome.runtime.onMessage.addListener(messageListener);

        // Load both task state and active session
        chrome.storage.local.get(['taskState', 'isMinimized', 'activeSession'], (result) => {
            console.log('Loaded from storage:', result);

            if (result.taskState) {
                setState(result.taskState);
            }

            // Load minimized state
            if (result.isMinimized !== undefined) {
                setIsMinimized(result.isMinimized);
            }

            // If there's an active session, update the state
            if (result.activeSession?.taskId && result.activeSession.status === 'active') {
                setState(prev => ({
                    ...prev,
                    taskId: result.activeSession.taskId,
                    status: 'running',
                    isRunning: true
                }));
            }
        });

        // Apply glass morphism style to body
        document.body.style.background = 'transparent';

        // Cleanup listener on unmount
        return () => {
            chrome.runtime.onMessage.removeListener(messageListener);
        };
    }, []);

    // Save minimized state when it changes
    useEffect(() => {
        chrome.storage.local.set({ isMinimized });
    }, [isMinimized]);

    // Add this effect to communicate minimized state changes
    useEffect(() => {
        // Communicate minimized state to content script
        const sendStateToContentScript = () => {
            if (typeof chrome !== 'undefined' && chrome.tabs) {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0] && tabs[0].id) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            type: 'updateMinimizedState',
                            isMinimized
                        }).catch(err => {
                            console.error('Error sending minimized state:', err);
                        });
                    }
                });
            }
        };

        sendStateToContentScript();
    }, [isMinimized]);

    const handleStartTask = async () => {
        if (!state.task.trim()) {
            return; // Don't start empty tasks
        }

        try {
            console.log('Starting task...');
            setState(prev => ({ ...prev, status: 'running' }));

            const message: Message = {
                type: 'startTask',
                task: state.task
            };

            const response = await chrome.runtime.sendMessage(message);
            console.log('Task started:', response);

            if (response?.task_id) {
                const newState: TaskState = {
                    ...state,
                    taskId: response.task_id,
                    status: 'running',
                    isRunning: true,
                    iterations: 0
                };

                await chrome.storage.local.set({ taskState: newState });
                setState(newState);

                // Start the monitoring loop
                chrome.runtime.sendMessage({ type: 'startMonitoring', task_id: response.task_id });
            }
        } catch (error) {
            console.error('Error starting task:', error);
            setState(prev => ({ ...prev, status: 'error' }));
        }
    };

    const handleStopTask = async () => {
        try {
            console.log('Stopping task...');
            setState(prev => ({ ...prev, status: 'idle' }));
            chrome.runtime.sendMessage({ type: 'stopMonitoring' });
            const newState: TaskState = {
                ...state,
                status: 'idle',
                isRunning: false
            };
            await chrome.storage.local.set({ taskState: newState });
            setState(newState);
        } catch (error) {
            console.error('Error stopping task:', error);
        }
    };

    // const handleToggleUI = () => {
    //     chrome.runtime.sendMessage({ type: 'toggleUI' });
    // };

    // Status badge color
    const getStatusColor = () => {
        switch (state.status) {
            case 'running': return 'bg-green-500';
            case 'error': return 'bg-red-500';
            case 'idle': return 'bg-yellow-500';
            case 'completed': return 'bg-blue-500';
            default: return 'bg-gray-400';
        }
    };

    // Status text
    const getStatusText = () => {
        switch (state.status) {
            case 'running': return 'Running';
            case 'error': return 'Error';
            case 'idle': return 'Idle';
            case 'completed': return 'Completed';
            default: return 'Idle';
        }
    };

    if (isMinimized) {
        return (
            <div className="fixed bottom-4 right-4 z-50">
                <button
                    onClick={() => setIsMinimized(false)}
                    className="flex items-center justify-center w-14 h-14 rounded-full bg-slate-800/90 hover:bg-slate-700/90 text-white shadow-lg transition-all duration-300 hover:shadow-xl border border-slate-700/50 backdrop-blur-sm drag-handle"
                    title="Open Automation Panel"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-7 w-7"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                </button>
                {state.isRunning && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 animate-pulse border-2 border-white"></div>
                )}
            </div>
        );
    }

    return (
        <div className="min-w-96 h-full flex flex-col bg-transparent overflow-hidden">
            {/* Glass morphism container */}
            <div className="h-full w-full flex flex-col bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-xl overflow-hidden border border-slate-700/50">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 bg-slate-700/90 border-b border-slate-600/90">
                    <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                        </svg>
                        Browser Automation
                    </h2>
                    <button
                        onClick={() => setIsMinimized(true)}
                        className="p-2 rounded-md text-slate-300 hover:text-white hover:bg-slate-600/90 focus:outline-none focus:ring-2 focus:ring-slate-400"
                        title="Minimize"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 p-5 space-y-5 overflow-y-auto w-96">
                    <div>
                        <label htmlFor="task-input" className="block text-sm font-medium text-slate-300 mb-2">
                            Task Description
                        </label>
                        <input
                            id="task-input"
                            type="text"
                            value={state.task}
                            onChange={(e) => setState(prev => ({ ...prev, task: e.target.value }))}
                            placeholder="Enter what you want to automate..."
                            disabled={state.isRunning}
                            className="w-full px-4 py-3 bg-slate-700/80 border border-slate-600/90 rounded-md shadow-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                    </div>

                    <div>
                        {!state.isRunning ? (
                            <button
                                onClick={handleStartTask}
                                disabled={!state.task.trim()}
                                className="w-full px-4 py-3 text-white bg-blue-600/90 hover:bg-blue-700/90 rounded-md shadow-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                            >
                                Start Automation
                            </button>
                        ) : (
                            <button
                                onClick={handleStopTask}
                                className="w-full px-4 py-3 text-white bg-red-600/90 hover:bg-red-700/90 rounded-md shadow-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                            >
                                Stop Automation
                            </button>
                        )}
                    </div>

                    {/* Status Panel */}
                    <div className="p-4 bg-slate-700/80 rounded-lg border border-slate-600/90">
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">Status:</span>
                                <div className="flex items-center space-x-2">
                                    <span className={`inline-block w-3 h-3 rounded-full ${getStatusColor()}`}></span>
                                    <span className="font-medium text-white">{getStatusText()}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-3 border-t border-slate-600/80">
                                <span className="text-slate-400">Task ID:</span>
                                <span className="font-mono text-xs bg-slate-800/80 px-2 py-1 rounded text-slate-300">
                                    {state.taskId ? state.taskId.substring(0, 10) : 'None'}
                                </span>
                            </div>

                            <div className="flex justify-between items-center pt-3 border-t border-slate-600/80">
                                <span className="text-slate-400">Iterations:</span>
                                <div className="flex items-center">
                                    <span className="font-medium text-white">{state.iterations}</span>
                                    {state.isRunning && state.iterations > 0 && (
                                        <span className="ml-2 text-xs px-2 py-0.5 bg-blue-500 rounded-full text-white">
                                            Running
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}