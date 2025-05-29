import {ISerializeCallback} from "../interfaces/serialize-callback";
import {IPassportSession} from "../interfaces/passport-session";

// Parse the user id to deserialize function
export function serialize($user: IPassportSession, done: ISerializeCallback) {
  console.log("=== SERIALIZE DEBUG ===");
  console.log("Serializing user:", $user);
  console.log("User ID:", $user?.id);
  
  done(null, { id: $user?.id ?? null });
}
