import { NextFunction } from "express";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { ISurveySubmissionRequest } from "../../interfaces/survey";

export default function surveySubmissionValidator(req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const body = req.body as ISurveySubmissionRequest;

  if (!body) {
    return res.status(200).send(new ServerResponse(false, null, "Request body is required"));
  }

  if (!body.survey_id || typeof body.survey_id !== 'string') {
    return res.status(200).send(new ServerResponse(false, null, "Survey ID is required and must be a string"));
  }

  if (!body.answers || !Array.isArray(body.answers)) {
    return res.status(200).send(new ServerResponse(false, null, "Answers are required and must be an array"));
  }

  // Validate each answer
  for (let i = 0; i < body.answers.length; i++) {
    const answer = body.answers[i];
    
    if (!answer.question_id || typeof answer.question_id !== 'string') {
      return res.status(200).send(new ServerResponse(false, null, `Answer ${i + 1}: Question ID is required and must be a string`));
    }

    // answer_text and answer_json are both optional - users can submit empty answers

    // Validate answer_text if provided
    if (answer.answer_text && typeof answer.answer_text !== 'string') {
      return res.status(200).send(new ServerResponse(false, null, `Answer ${i + 1}: answer_text must be a string`));
    }

    // Validate answer_json if provided
    if (answer.answer_json && !Array.isArray(answer.answer_json)) {
      return res.status(200).send(new ServerResponse(false, null, `Answer ${i + 1}: answer_json must be an array`));
    }

    // Validate answer_json items are strings
    if (answer.answer_json) {
      for (let j = 0; j < answer.answer_json.length; j++) {
        if (typeof answer.answer_json[j] !== 'string') {
          return res.status(200).send(new ServerResponse(false, null, `Answer ${i + 1}: answer_json items must be strings`));
        }
      }
    }
  }

  return next();
}