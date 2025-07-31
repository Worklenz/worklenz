export interface ISerializeCallback {
  (error: string | null, user: { id: string | null } | null): void;
}
