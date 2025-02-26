export interface FrontendDOMState {
    url: string;
    html: string;
    title: string;
    timestamp: string;
    structure?: object;
}

export interface DOMUpdate {
    task_id: string;
    dom_data: FrontendDOMState;
    result: unknown[];
    iterations: number;
    structure: object;
}

export interface Message {
    type: string;
    task?: string;
    task_id?: string;
    dom_data?: FrontendDOMState;
    result?: unknown[];
    iterations?: number;
    isPaused?: boolean;
}

export interface TaskState {
    taskId: string | null;
    status: 'idle' | 'running' | 'completed' | 'error' | 'paused';
    task: string;
    isRunning: boolean;
    iterations: number;
    isPaused: boolean;
}