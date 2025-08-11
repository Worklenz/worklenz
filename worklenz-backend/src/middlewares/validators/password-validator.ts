import {NextFunction, Request, Response} from "express";

import {ServerResponse} from "../../models/server-response";
import {isProduction} from "../../shared/utils";
import {PasswordStrengthChecker} from "../../shared/password-strength-check";
import {PASSWORD_POLICY} from "../../shared/constants";

function isStrongPassword(password: string) {
  if (!isProduction()) return true;
  const strength = PasswordStrengthChecker.validate(password);
  return strength.value >= 2 && strength.length <= 32;
}

export default function (req: Request, res: Response, next: NextFunction) {
  const {confirm_password, new_password, password} = req.body;

  const psw = (password || "").trim();
  const newPws = (new_password || "").trim();

  if (!psw)
    return res.status(200).send(new ServerResponse(false, null, "Password is required"));

  if (newPws) {
    if (!isStrongPassword(newPws))
      return res.status(200).send(new ServerResponse(false, null, PASSWORD_POLICY).withTitle("Please use a strong new password."));

    if (newPws !== confirm_password)
      return res.status(200).send(new ServerResponse(false, null, "Passwords do not match"));
  } else if (!isStrongPassword(psw)) {
    return res.status(200).send(new ServerResponse(false, null, PASSWORD_POLICY).withTitle("Please use a strong password."));
  }

  return next();
}
