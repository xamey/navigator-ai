export interface FrontendDOMState {
    url: string;
}

export interface Message {
    type: string;
    task?: string;
    task_id?: string;
    dom_data?: FrontendDOMState;
    result?: unknown[];
}

export interface TaskState {
    taskId: string | null;
    status: 'idle' | 'running' | 'completed' | 'error';
    task: string;
} 