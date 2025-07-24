import { AlertType } from '@/types/alert.types';
import DOMPurify from 'dompurify';
import { notification } from '@/shared/antd-imports';
class AlertService {
  private static instance: AlertService;
  private activeAlerts: Set<string> = new Set();

  private constructor() {}

  public static getInstance(): AlertService {
    if (!AlertService.instance) {
      AlertService.instance = new AlertService();
    }
    return AlertService.instance;
  }

  private sanitizeHtml(content: string): string {
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
      ALLOWED_ATTR: ['href', 'target'],
    });
  }

  private show(type: AlertType, title: string, message: string, duration?: number): void {
    if (this.activeAlerts.has(message)) return;

    const safeTitle = this.sanitizeHtml(title);
    const safeMessage = this.sanitizeHtml(message);

    this.activeAlerts.add(message);

    notification[type]({
      message: safeTitle,
      description: safeMessage,
      duration: duration || 5,
      placement: 'topRight',
      style: { borderRadius: '4px' },
      onClose: () => {
        this.activeAlerts.delete(message);
      },
    });
  }

  public success(title: string, message: string, duration?: number): void {
    this.show('success', title, message, duration);
  }

  public error(title: string, message: string, duration?: number): void {
    this.show('error', title, message, duration);
  }

  public info(title: string, message: string, duration?: number): void {
    this.show('info', title, message, duration);
  }

  public warning(title: string, message: string, duration?: number): void {
    this.show('warning', title, message, duration);
  }

  public clearAll(): void {
    notification.destroy();
    this.activeAlerts.clear();
  }
}

export const alertService = AlertService.getInstance();
export default alertService;
