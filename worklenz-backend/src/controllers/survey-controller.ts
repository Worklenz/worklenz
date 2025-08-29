import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { ISurveySubmissionRequest } from "../interfaces/survey";
import db from "../config/db";

export default class SurveyController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getAccountSetupSurvey(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT 
        s.id,
        s.name,
        s.description,
        s.survey_type,
        s.is_active,
        COALESCE(
          json_agg(
            json_build_object(
              'id', sq.id,
              'survey_id', sq.survey_id,
              'question_key', sq.question_key,
              'question_type', sq.question_type,
              'is_required', sq.is_required,
              'sort_order', sq.sort_order,
              'options', sq.options
            ) ORDER BY sq.sort_order
          ) FILTER (WHERE sq.id IS NOT NULL), 
          '[]'
        ) AS questions
      FROM surveys s
      LEFT JOIN survey_questions sq ON s.id = sq.survey_id
      WHERE s.survey_type = 'account_setup' AND s.is_active = true
      GROUP BY s.id, s.name, s.description, s.survey_type, s.is_active
      LIMIT 1;
    `;

    const result = await db.query(q);
    const [survey] = result.rows;

    if (!survey) {
      return res.status(200).send(new ServerResponse(false, null, "Account setup survey not found"));
    }

    return res.status(200).send(new ServerResponse(true, survey));
  }

  @HandleExceptions()
  public static async submitSurveyResponse(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const userId = req.user?.id;
    const body = req.body as ISurveySubmissionRequest;

    if (!userId) {
      return res.status(200).send(new ServerResponse(false, null, "User not authenticated"));
    }

    if (!body.survey_id || !body.answers || !Array.isArray(body.answers)) {
      return res.status(200).send(new ServerResponse(false, null, "Invalid survey submission data"));
    }

    // Check if user has already submitted a response for this survey
    const existingResponseQuery = `
      SELECT id FROM survey_responses 
      WHERE user_id = $1 AND survey_id = $2;
    `;
    const existingResult = await db.query(existingResponseQuery, [userId, body.survey_id]);

    let responseId: string;

    if (existingResult.rows.length > 0) {
      // Update existing response
      responseId = existingResult.rows[0].id;
      
      const updateResponseQuery = `
        UPDATE survey_responses 
        SET is_completed = true, completed_at = NOW(), updated_at = NOW()
        WHERE id = $1;
      `;
      await db.query(updateResponseQuery, [responseId]);

      // Delete existing answers
      const deleteAnswersQuery = `DELETE FROM survey_answers WHERE response_id = $1;`;
      await db.query(deleteAnswersQuery, [responseId]);
    } else {
      // Create new response
      const createResponseQuery = `
        INSERT INTO survey_responses (survey_id, user_id, is_completed, completed_at)
        VALUES ($1, $2, true, NOW())
        RETURNING id;
      `;
      const responseResult = await db.query(createResponseQuery, [body.survey_id, userId]);
      responseId = responseResult.rows[0].id;
    }

    // Insert new answers
    if (body.answers.length > 0) {
      const answerValues: string[] = [];
      const params: any[] = [];
      
      body.answers.forEach((answer, index) => {
        const baseIndex = index * 4;
        answerValues.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4})`);
        
        params.push(
          responseId,
          answer.question_id,
          answer.answer_text || null,
          answer.answer_json ? JSON.stringify(answer.answer_json) : null
        );
      });

      const insertAnswersQuery = `
        INSERT INTO survey_answers (response_id, question_id, answer_text, answer_json)
        VALUES ${answerValues.join(', ')};
      `;

      await db.query(insertAnswersQuery, params);
    }

    return res.status(200).send(new ServerResponse(true, { response_id: responseId }));
  }

  @HandleExceptions()
  public static async getUserSurveyResponse(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const userId = req.user?.id;
    const surveyId = req.params.survey_id;

    if (!userId) {
      return res.status(200).send(new ServerResponse(false, null, "User not authenticated"));
    }

    const q = `
      SELECT 
        sr.id,
        sr.survey_id,
        sr.user_id,
        sr.is_completed,
        sr.started_at,
        sr.completed_at,
        COALESCE(
          json_agg(
            json_build_object(
              'question_id', sa.question_id,
              'answer_text', sa.answer_text,
              'answer_json', sa.answer_json
            )
          ) FILTER (WHERE sa.id IS NOT NULL),
          '[]'
        ) AS answers
      FROM survey_responses sr
      LEFT JOIN survey_answers sa ON sr.id = sa.response_id
      WHERE sr.user_id = $1 AND sr.survey_id = $2
      GROUP BY sr.id, sr.survey_id, sr.user_id, sr.is_completed, sr.started_at, sr.completed_at;
    `;

    const result = await db.query(q, [userId, surveyId]);
    const [response] = result.rows;

    if (!response) {
      return res.status(200).send(new ServerResponse(false, null, "Survey response not found"));
    }

    return res.status(200).send(new ServerResponse(true, response));
  }

  @HandleExceptions()
  public static async checkAccountSetupSurveyStatus(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(200).send(new ServerResponse(false, null, "User not authenticated"));
    }

    const q = `
      SELECT EXISTS(
        SELECT 1 
        FROM survey_responses sr
        INNER JOIN surveys s ON sr.survey_id = s.id
        WHERE sr.user_id = $1 
        AND s.survey_type = 'account_setup'
        AND sr.is_completed = true
      ) as is_completed,
      (
        SELECT sr.completed_at
        FROM survey_responses sr
        INNER JOIN surveys s ON sr.survey_id = s.id
        WHERE sr.user_id = $1 
        AND s.survey_type = 'account_setup'
        AND sr.is_completed = true
        LIMIT 1
      ) as completed_at;
    `;

    const result = await db.query(q, [userId]);
    const status = result.rows[0] || { is_completed: false, completed_at: null };

    return res.status(200).send(new ServerResponse(true, status));
  }
}