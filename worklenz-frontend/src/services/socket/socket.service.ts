import { Message, User } from '@/types/socket.types';
import logger from '@/utils/errorLogger';
import { Socket } from 'socket.io-client';

export class SocketService {
  private socket: Socket | null = null;
  private static instance: SocketService | null = null;

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  public init(socket: Socket): void {
    if (!this.socket) {
      this.socket = socket;
      this.setupDefaultListeners();
    }
  }

  private setupDefaultListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      logger.info('Socket connected in service');
    });

    this.socket.on('disconnect', () => {
      logger.info('Socket disconnected in service');
    });

    this.socket.on('error', (error: Error) => {
      logger.error('Socket error', { error });
    });
  }

  // Message Methods
  public sendMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      this.socket.emit(
        'send_message',
        message,
        (response: { success: boolean; error?: string }) => {
          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.error || 'Failed to send message'));
          }
        }
      );
    });
  }

  public onMessage(callback: (message: Message) => void): () => void {
    if (!this.socket) throw new Error('Socket not initialized');

    this.socket.on('message', callback);
    return () => this.socket?.off('message', callback);
  }

  // User Methods
  public updateUserStatus(status: User['status']): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      this.socket.emit('update_status', { status }, (response: { success: boolean }) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error('Failed to update status'));
        }
      });
    });
  }

  public onUserStatusChange(callback: (user: User) => void): () => void {
    if (!this.socket) throw new Error('Socket not initialized');

    this.socket.on('user_status_changed', callback);
    return () => this.socket?.off('user_status_changed', callback);
  }

  // Room Methods
  public joinRoom(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      this.socket.emit('join_room', { roomId }, (response: { success: boolean }) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error('Failed to join room'));
        }
      });
    });
  }

  public leaveRoom(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      this.socket.emit('leave_room', { roomId }, (response: { success: boolean }) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error('Failed to leave room'));
        }
      });
    });
  }

  // Custom Event Handler
  public on<T>(event: string, callback: (data: T) => void): () => void {
    if (!this.socket) throw new Error('Socket not initialized');

    this.socket.on(event, callback);
    return () => this.socket?.off(event, callback);
  }

  public emit<T>(event: string, data: T): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      this.socket.emit(event, data, (response: { success: boolean; error?: string }) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error || 'Emission failed'));
        }
      });
    });
  }
}
