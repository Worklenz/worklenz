export type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug';

interface LogStyles {
  title: string;
  text: string;
  background?: string;
}

interface LogOptions {
  showTimestamp?: boolean;
  collapsed?: boolean;
  level?: LogLevel;
}

class ConsoleLogger {
  private readonly isProduction = import.meta.env.PROD;

  private readonly styles: Record<LogLevel, LogStyles> = {
    info: {
      title: 'color: #1890ff; font-weight: bold; font-size: 12px;',
      text: 'color: #1890ff; font-size: 12px;',
      background: 'background: transparent; padding: 2px 5px; border-radius: 2px;',
    },
    success: {
      title: 'color: #52c41a; font-weight: bold; font-size: 12px;',
      text: 'color: #52c41a; font-size: 12px;',
      background: 'background: transparent; padding: 2px 5px; border-radius: 2px;',
    },
    warning: {
      title: 'color: #faad14; font-weight: bold; font-size: 12px;',
      text: 'color: #faad14; font-size: 12px;',
      background: 'background: transparent; padding: 2px 5px; border-radius: 2px;',
    },
    error: {
      title: 'color: #ff4d4f; font-weight: bold; font-size: 12px;',
      text: 'color: #ff4d4f; font-size: 12px;',
      background: 'background: transparent; padding: 2px 5px; border-radius: 2px;',
    },
    debug: {
      title: 'color: #722ed1; font-weight: bold; font-size: 12px;',
      text: 'color: #722ed1; font-size: 12px;',
      background: 'background: transparent; padding: 2px 5px; border-radius: 2px;',
    },
  };

  // Private helper methods
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private formatValue(value: unknown): unknown {
    if (value instanceof Error) {
      const { name, message, stack } = value;
      return { name, message, stack };
    }
    return value;
  }

  private formatLogMessage(title: string, showTimestamp: boolean, styles: LogStyles): string {
    const timestamp = showTimestamp ? `[${this.getTimestamp()}] ` : '';
    return `%c${timestamp}${title}`;
  }

  private logObjectData(data: Record<string, unknown>, styles: LogStyles): void {
    for (const [key, value] of Object.entries(data)) {
      console.log(`%c${key}:`, styles.title, this.formatValue(value));
    }
  }

  private log(
    title: string,
    data: unknown,
    { showTimestamp = true, collapsed = false, level = 'info' }: LogOptions = {}
  ): void {
    if (this.isProduction) return;

    const styles = this.styles[level];
    const logMethod = collapsed ? console.groupCollapsed : console.group;
    const formattedMessage = this.formatLogMessage(title, showTimestamp, styles);

    logMethod(formattedMessage, styles.background ?? styles.title);

    if (data !== null) {
      if (typeof data === 'object' && data !== null) {
        this.logObjectData(data as Record<string, unknown>, styles);
      } else {
        console.log(`%cValue:`, styles.title, this.formatValue(data));
      }
    }

    console.groupEnd();
  }

  // Public logging methods
  public info(title: string, data: unknown = null, options?: Omit<LogOptions, 'level'>): void {
    this.log(title, data, { ...options, level: 'info' });
  }

  public success(title: string, data: unknown = null, options?: Omit<LogOptions, 'level'>): void {
    this.log(title, data, { ...options, level: 'success' });
  }

  public warning(title: string, data: unknown = null, options?: Omit<LogOptions, 'level'>): void {
    this.log(title, data, { ...options, level: 'warning' });
  }

  public error(title: string, data: unknown = null, options?: Omit<LogOptions, 'level'>): void {
    this.log(title, data, { ...options, level: 'error' });
  }

  public debug(title: string, data: unknown = null, options?: Omit<LogOptions, 'level'>): void {
    this.log(title, data, { ...options, level: 'debug' });
  }

  // Table logging
  public table(title: string, data: unknown[] = []): void {
    if (this.isProduction) return;

    console.group(`%c${title}`, this.styles.info.title);
    if (data.length > 0) {
      console.table(data);
    }
    console.groupEnd();
  }

  // Performance logging
  public time(label: string): void {
    if (this.isProduction) return;
    console.time(label);
  }

  public timeEnd(label: string): void {
    if (this.isProduction) return;
    console.timeEnd(label);
  }

  // Group logging
  public group(title: string, collapsed = false): void {
    if (this.isProduction) return;

    const method = collapsed ? console.groupCollapsed : console.group;
    method(`%c${title}`, this.styles.info.title);
  }

  public groupEnd(): void {
    if (this.isProduction) return;
    console.groupEnd();
  }
}

// Create default instance
const logger = new ConsoleLogger();
export default logger;
