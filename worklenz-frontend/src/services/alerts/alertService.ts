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

  private show(
    type: AlertType,
    title: string,
    message: string,
    duration?: number,
    dedupeKey?: string
  ): void {
    // Defaults to the message text (existing behavior everywhere that doesn't
    // pass one): dedupes identical alerts. Callers whose message text is
    // shared across genuinely distinct events (e.g. the same generic failure
    // text for two different background jobs) should pass an explicit
    // per-event dedupeKey so one doesn't silently swallow the other.
    const key = dedupeKey ?? message;
    if (this.activeAlerts.has(key)) return;

    const safeTitle = this.sanitizeHtml(title);
    const safeMessage = this.sanitizeHtml(message);

    this.activeAlerts.add(key);

    notification[type]({
      message: safeTitle,
      description: safeMessage,
      duration: duration || 5,
      placement: 'topRight',
      style: { borderRadius: '4px' },
      onClose: () => {
        this.activeAlerts.delete(key);
      },
    });
  }

  public success(title: string, message: string, duration?: number, dedupeKey?: string): void {
    this.show('success', title, message, duration, dedupeKey);
  }

  public error(title: string, message: string, duration?: number, dedupeKey?: string): void {
    this.show('error', title, message, duration, dedupeKey);
  }

  public info(title: string, message: string, duration?: number, dedupeKey?: string): void {
    this.show('info', title, message, duration, dedupeKey);
  }

  public warning(title: string, message: string, duration?: number, dedupeKey?: string): void {
    this.show('warning', title, message, duration, dedupeKey);
  }

  public clearAll(): void {
    notification.destroy();
    this.activeAlerts.clear();
  }
}

export const alertService = AlertService.getInstance();
export default alertService;
