import {NextFunction, Request, Response} from "express";

import {ServerResponse} from "../../models/server-response";
import {isValidateEmail, sanitizeName, sanitizeEmail, sanitizePassword} from "../../shared/utils";

export default function (req: Request, res: Response, next: NextFunction) {
  const {name, email, password} = req.body;

  if (!name) return res.status(200).send(new ServerResponse(false, null, "Name is required"));
  if (!email) return res.status(200).send(new ServerResponse(false, null, "Email is required"));
  if (!password) return res.status(200).send(new ServerResponse(false, null, "Password is required"));
  
  // Sanitize inputs
  const sanitizedName = sanitizeName(name);
  const sanitizedEmail = sanitizeEmail(email);
  const sanitizedPassword = sanitizePassword(password);
  
  // Validate sanitized inputs
  if (!sanitizedName.trim()) return res.status(200).send(new ServerResponse(false, null, "Invalid name format"));
  if (!sanitizedEmail.trim()) return res.status(200).send(new ServerResponse(false, null, "Invalid email format"));
  if (!sanitizedPassword.trim()) return res.status(200).send(new ServerResponse(false, null, "Invalid password format"));
  if (!isValidateEmail(sanitizedEmail)) return res.status(200).send(new ServerResponse(false, null, "Invalid email address"));
  
  // Update request body with sanitized values
  req.body.name = sanitizedName;
  req.body.email = sanitizedEmail;
  req.body.password = sanitizedPassword;
  req.body.team_name = sanitizedName.trim();

  return next();
}
