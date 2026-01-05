import { PassportStatic } from "passport";

import { deserialize } from "./deserialize";
import { serialize } from "./serialize";

import GoogleLogin from "./passport-strategies/passport-google";
import GoogleMobileLogin from "./passport-strategies/passport-google-mobile";
import AppleMobileLogin from "./passport-strategies/passport-apple-mobile";
import AppleWebLogin from "./passport-strategies/passport-apple-web";
import LocalLogin from "./passport-strategies/passport-local-login";
import LocalSignup from "./passport-strategies/passport-local-signup";

/**
 * Use any passport middleware before the serialize and deserialize
 * @param {Passport} passport
 */
export default (passport: PassportStatic) => {
  passport.use("local-login", LocalLogin);
  passport.use("local-signup", LocalSignup);
  passport.use(GoogleLogin);
  passport.use("google-mobile", GoogleMobileLogin);
  passport.use("apple-mobile", AppleMobileLogin);

  // Only register Apple Web strategy if it's configured
  if (AppleWebLogin) {
    passport.use("apple", AppleWebLogin);
  }

  passport.serializeUser(serialize);
  passport.deserializeUser(deserialize);
};
