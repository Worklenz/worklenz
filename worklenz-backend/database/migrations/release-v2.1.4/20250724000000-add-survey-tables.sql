-- Migration: Add survey tables for account setup questionnaire
-- Date: 2025-07-24
-- Description: Creates tables to store survey questions and user responses for account setup flow

BEGIN;

-- Create surveys table to define different types of surveys
CREATE TABLE IF NOT EXISTS surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    survey_type VARCHAR(50) DEFAULT 'account_setup' NOT NULL, -- 'account_setup', 'onboarding', 'feedback'
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Create survey_questions table to store individual questions
CREATE TABLE IF NOT EXISTS survey_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE NOT NULL,
    question_key VARCHAR(100) NOT NULL, -- Used for localization keys
    question_type VARCHAR(50) NOT NULL, -- 'single_choice', 'multiple_choice', 'text'
    is_required BOOLEAN DEFAULT FALSE NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    options JSONB, -- For choice questions, store options as JSON array
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Create survey_responses table to track user responses to surveys
CREATE TABLE IF NOT EXISTS survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE NOT NULL,
    started_at TIMESTAMP DEFAULT now() NOT NULL,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Create survey_answers table to store individual question answers
CREATE TABLE IF NOT EXISTS survey_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    response_id UUID REFERENCES survey_responses(id) ON DELETE CASCADE NOT NULL,
    question_id UUID REFERENCES survey_questions(id) ON DELETE CASCADE NOT NULL,
    answer_text TEXT,
    answer_json JSONB, -- For multiple choice answers stored as array
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_surveys_type_active ON surveys(survey_type, is_active);
CREATE INDEX IF NOT EXISTS idx_survey_questions_survey_order ON survey_questions(survey_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_survey_responses_user_survey ON survey_responses(user_id, survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_completed ON survey_responses(survey_id, is_completed);
CREATE INDEX IF NOT EXISTS idx_survey_answers_response ON survey_answers(response_id);

-- Add constraints
ALTER TABLE survey_questions ADD CONSTRAINT survey_questions_sort_order_check CHECK (sort_order >= 0);
ALTER TABLE survey_questions ADD CONSTRAINT survey_questions_type_check CHECK (question_type IN ('single_choice', 'multiple_choice', 'text'));

-- Add unique constraint to prevent duplicate responses per user per survey
ALTER TABLE survey_responses ADD CONSTRAINT unique_user_survey_response UNIQUE (user_id, survey_id);

-- Add unique constraint to prevent duplicate answers per question per response
ALTER TABLE survey_answers ADD CONSTRAINT unique_response_question_answer UNIQUE (response_id, question_id);

-- Insert the default account setup survey
INSERT INTO surveys (name, description, survey_type, is_active) VALUES 
('Account Setup Survey', 'Initial questionnaire during account setup to understand user needs', 'account_setup', true)
ON CONFLICT DO NOTHING;

-- Get the survey ID for inserting questions
DO $$
DECLARE
    survey_uuid UUID;
BEGIN
    SELECT id INTO survey_uuid FROM surveys WHERE survey_type = 'account_setup' AND name = 'Account Setup Survey' LIMIT 1;
    
    -- Insert survey questions
    INSERT INTO survey_questions (survey_id, question_key, question_type, is_required, sort_order, options) VALUES
    (survey_uuid, 'organization_type', 'single_choice', true, 1, '["freelancer", "startup", "small_medium_business", "agency", "enterprise", "other"]'),
    (survey_uuid, 'user_role', 'single_choice', true, 2, '["founder_ceo", "project_manager", "software_developer", "designer", "operations", "other"]'),
    (survey_uuid, 'main_use_cases', 'multiple_choice', true, 3, '["task_management", "team_collaboration", "resource_planning", "client_communication", "time_tracking", "other"]'),
    (survey_uuid, 'previous_tools', 'text', false, 4, null),
    (survey_uuid, 'how_heard_about', 'single_choice', false, 5, '["google_search", "twitter", "linkedin", "friend_colleague", "blog_article", "other"]')
    ON CONFLICT DO NOTHING;
END $$;

COMMIT;