export interface IUserRecentTask {
    task_id: string;
    task_name: string;
    project_id: string;
    project_name: string;
    last_activity_at: string;
    activity_count: number;
}

export interface IUserTimeLoggedTask {
    task_id: string;
    task_name: string;
    project_id: string;
    project_name: string;
    total_time_logged: number;
    total_time_logged_string: string;
    last_logged_at: string;
    logged_by_timer: boolean;
}

export enum ActivityFeedType {
    RECENT_TASKS = 'recent-tasks',
    TIME_LOGGED_TASKS = 'time-logged-tasks'
}
