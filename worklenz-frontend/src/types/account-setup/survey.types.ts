export interface ISurveyQuestion {
  id: string;
  survey_id: string;
  question_key: string;
  question_type: 'single_choice' | 'multiple_choice' | 'text';
  is_required: boolean;
  sort_order: number;
  options?: string[];
}

export interface ISurvey {
  id: string;
  name: string;
  description?: string;
  survey_type: 'account_setup' | 'onboarding' | 'feedback';
  is_active: boolean;
  questions?: ISurveyQuestion[];
}

export interface ISurveyAnswer {
  question_id: string;
  answer_text?: string;
  answer_json?: string[];
}

export interface ISurveyResponse {
  id?: string;
  survey_id: string;
  user_id?: string;
  is_completed: boolean;
  answers: ISurveyAnswer[];
}

export interface ISurveySubmissionRequest {
  survey_id: string;
  answers: ISurveyAnswer[];
}

// Account setup survey specific types
export type OrganizationType = 'freelancer' | 'startup' | 'small_medium_business' | 'agency' | 'enterprise' | 'other';
export type UserRole = 'founder_ceo' | 'project_manager' | 'software_developer' | 'designer' | 'operations' | 'other';
export type UseCase = 'task_management' | 'team_collaboration' | 'resource_planning' | 'client_communication' | 'time_tracking' | 'other';
export type HowHeardAbout = 'google_search' | 'twitter' | 'linkedin' | 'friend_colleague' | 'blog_article' | 'other';

export interface IAccountSetupSurveyData {
  organization_type?: OrganizationType;
  user_role?: UserRole;
  main_use_cases?: UseCase[];
  previous_tools?: string;
  how_heard_about?: HowHeardAbout;
}