import { useEffect, useState } from 'react';
import type { Message, TaskState } from './types';

export default function Popup() {
    const [state, setState] = useState<TaskState>({
        taskId: null,
        status: 'idle',
        task: ''
    });

    useEffect(() => {
        try {
            // Load taskId from storage when component mounts
            chrome.storage.local.get(['taskId'], (result) => {
                if (result.taskId) {
                    setState(prev => ({ ...prev, taskId: result.taskId }));
                }
            });
        } catch (error) {
            console.error('Error loading taskId:', error);
        }
    }, []);

    const handleStartTask = async () => {
        try {
            setState(prev => ({ ...prev, status: 'running' }));

            const message: Message = {
                type: 'startTask',
                task: state.task
            };

            // Send message to background script
            const response = await chrome.runtime.sendMessage(message);

            if (response?.task_id) {
                // Store taskId in chrome storage
                await chrome.storage.local.set({ taskId: response.task_id });
                setState(prev => ({
                    ...prev,
                    taskId: response.task_id,
                    status: 'completed'
                }));
            }
        } catch (error) {
            console.error('Error starting task:', error);
            setState(prev => ({ ...prev, status: 'error' }));
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
                <button
                    onClick={handleStartTask}
                    disabled={state.status === 'running'}
                >
                    Start Task
                </button>
            </div>
            <div>
                <p>Task ID: {state.taskId || 'None'}</p>
                <p>Status: {state.status}</p>
            </div>
        </div>
    );
} 