import { TFunction } from 'i18next';
import DOMPurify from 'dompurify';

export interface INotificationMessageSource {
  message?: string;
  message_key?: string;
  message_params?: Record<string, any>;
}

const SANITIZE_OPTIONS = {
  ALLOWED_TAGS: ['b', 'strong', 'i', 'em'],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,
  ALLOW_DATA_ATTR: false,
  SAFE_FOR_TEMPLATES: true,
};

/**
 * Renders notification message with i18n support.
 * Falls back gracefully to legacy raw message if translation key is absent.
 */
export function renderNotificationMessage(
  notification: INotificationMessageSource,
  t: TFunction
): string {
  if (notification.message_key) {
    const rawKey = notification.message_key.replace(/^notifications\./, '');
    const translated = t(rawKey, {
      ...notification.message_params,
      defaultValue: notification.message || '',
    });
    return DOMPurify.sanitize(translated, SANITIZE_OPTIONS);
  }

  if (notification.message) {
    const legacyTranslation = translateLegacyNotificationMessage(notification.message, t);
    if (legacyTranslation) {
      return DOMPurify.sanitize(legacyTranslation, SANITIZE_OPTIONS);
    }

    return DOMPurify.sanitize(notification.message, SANITIZE_OPTIONS);
  }

  return '';
}

/**
 * Supports notification rows created before message_key/message_params were
 * persisted. Only known, system-generated English templates are translated;
 * all other legacy content remains untouched.
 */
function translateLegacyNotificationMessage(message: string, t: TFunction): string | null {
  const taskAssignment = matchLegacyMessage(
    message,
    /^<(?:(?:b)|(?:strong))>(.+?)<\/(?:(?:b)|(?:strong))> has assigned you (?:in|to) <(?:(?:b)|(?:strong))>(.+?)<\/(?:(?:b)|(?:strong))>$/
  );
  if (taskAssignment) {
    return t('taskAssigned', {
      reporter: taskAssignment[0],
      task: taskAssignment[1],
      defaultValue: message,
    });
  }

  const taskRemoval = matchLegacyMessage(
    message,
    /^<(?:(?:b)|(?:strong))>(.+?)<\/(?:(?:b)|(?:strong))> has removed you from <(?:(?:b)|(?:strong))>(.+?)<\/(?:(?:b)|(?:strong))>$/
  );
  if (taskRemoval) {
    return t('taskRemoved', {
      reporter: taskRemoval[0],
      task: taskRemoval[1],
      defaultValue: message,
    });
  }

  const commentAdded = matchLegacyMessage(
    message,
    /^<(?:(?:b)|(?:strong))>(.+?)<\/(?:(?:b)|(?:strong))> added a comment on <(?:(?:b)|(?:strong))>(.+?)<\/(?:(?:b)|(?:strong))>(?: \(.+\))?$/
  );
  if (commentAdded) {
    return t('commentAdded', {
      user: commentAdded[0],
      task: commentAdded[1],
      defaultValue: message,
    });
  }

  const addedToProject = matchLegacyMessage(
    message,
    /^You have been added to the <(?:(?:b)|(?:strong))>(.+?)<\/(?:(?:b)|(?:strong))> by <(?:(?:b)|(?:strong))>(.+?)<\/(?:(?:b)|(?:strong))>$/
  );
  if (addedToProject) {
    return t('addedToProject', {
      project: addedToProject[0],
      user: addedToProject[1],
      defaultValue: message,
    });
  }

  return null;
}

function matchLegacyMessage(message: string, pattern: RegExp): [string, string] | null {
  const match = message.match(pattern);
  return match ? [match[1], match[2]] : null;
}
