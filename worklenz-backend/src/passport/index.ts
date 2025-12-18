import {PassportStatic} from "passport";

import {deserialize} from "./deserialize";
import {serialize} from "./serialize";

import LocalLogin from "./passport-strategies/passport-local-login";
import LocalSignup from "./passport-strategies/passport-local-signup";

const isGoogleAuthEnabled = process.env.ENABLE_GOOGLE_AUTH === "true";

/**
 * Use any passport middleware before the serialize and deserialize
 * @param {Passport} passport
 */
export default (passport: PassportStatic) => {
  passport.use("local-login", LocalLogin);
  passport.use("local-signup", LocalSignup);
  if (isGoogleAuthEnabled) {
    const {default: GoogleLogin} = require("./passport-strategies/passport-google");
    const {default: GoogleMobileLogin} = require("./passport-strategies/passport-google-mobile");

    passport.use(GoogleLogin);
    passport.use("google-mobile", GoogleMobileLogin);
  }
  passport.serializeUser(serialize);
  passport.deserializeUser(deserialize);
};
