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

    useEffect(() => {
        // Load both task state and active session
        chrome.storage.local.get(['taskState', 'activeSession'], (result) => {
            if (result.taskState) {
                setState(result.taskState);
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
    }, []);

    const handleStartTask = async () => {
        try {
            const message: Message = {
                type: 'startTask',
                task: state.task
            };

            const response = await chrome.runtime.sendMessage(message);

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

    return (
        <div className="popup">
            <h1>Browser Automation</h1>
            <div>
                <input
                    type="text"
                    value={state.task}
                    onChange={(e) => setState(prev => ({ ...prev, task: e.target.value }))}
                    placeholder="Enter task description"
                />
                {!state.isRunning ? (
                    <button
                        onClick={handleStartTask}
                        disabled={state.status === 'running'}
                    >
                        Start Task
                    </button>
                ) : (
                    <button
                        onClick={handleStopTask}
                        className="stop"
                    >
                        Stop Tasksss
                    </button>
                )}
            </div>
            <div>
                <p>Task ID: {state.taskId || 'None'}</p>
                <p>Status: {state.status}</p>
                <p>Iterations: {state.iterations}</p>
            </div>
        </div>
    );
} 