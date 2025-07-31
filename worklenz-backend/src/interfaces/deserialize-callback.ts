import {IPassportSession} from "./passport-session";

export interface IDeserializeCallback {
  (error: unknown | null, user: IPassportSession | null): void;
}
