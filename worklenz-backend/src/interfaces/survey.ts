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