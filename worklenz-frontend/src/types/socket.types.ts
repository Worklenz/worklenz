export interface Message {
  id: string;
  text: string;
  userId: string;
  timestamp: Date;
}

export interface User {
  id: string;
  name: string;
  status: 'online' | 'offline';
}
