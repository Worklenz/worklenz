export interface ISocketSession {
  session?: {
    passport?: { user?: { id: string } }
  }
}
