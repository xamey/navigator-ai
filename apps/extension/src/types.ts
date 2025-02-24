export interface FrontendDOMState {
    url: string;
    html: string;
    title: string;
    timestamp: string;
}

export interface DOMUpdate {
    task_id: string;
    dom_data: FrontendDOMState;
    result: unknown[];
}

export interface Message {
    type: string;
    task?: string;
    task_id?: string;
    dom_data?: FrontendDOMState;
    result?: unknown[];
    iterations?: number;
}

export interface TaskState {
    taskId: string | null;
    status: 'idle' | 'running' | 'completed' | 'error';
    task: string;
    isRunning: boolean;
    iterations: number;
} 