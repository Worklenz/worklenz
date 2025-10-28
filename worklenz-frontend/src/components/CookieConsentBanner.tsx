import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { consentManager } from '../utils/consentManager';
import { useAppSelector } from '../hooks/useAppSelector';

/**
 * Cookie Consent Banner Component
 * Displays GDPR-compliant cookie consent banner for EEA/UK/CH users
 */
function CookieConsentBanner() {
  const { t } = useTranslation('common');
  const [isVisible, setIsVisible] = useState(false);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDarkMode = themeMode === 'dark';

  useEffect(() => {
    // Check if consent banner should be shown
    const needsConsent = consentManager.needsConsent();
    setIsVisible(needsConsent);
  }, []);

  const handleAccept = useCallback(() => {
    consentManager.acceptAll();
    setIsVisible(false);
  }, []);

  const handleReject = useCallback(() => {
    consentManager.rejectAll();
    setIsVisible(false);
  }, []);

  if (!isVisible) return null;

  const bannerBgClass = isDarkMode
    ? 'bg-gray-800 border-gray-700'
    : 'bg-white border-gray-200';
  const textClass = isDarkMode ? 'text-gray-200' : 'text-gray-800';
  const subtextClass = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const linkClass = isDarkMode
    ? 'text-blue-400 hover:text-blue-300'
    : 'text-blue-600 hover:text-blue-700';

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] p-4 sm:p-6 animate-slide-up"
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
    >
      <div
        className={`max-w-6xl mx-auto ${bannerBgClass} border rounded-lg shadow-2xl p-4 sm:p-6`}
      >
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Content Section */}
          <div className="flex-1">
            <h3
              id="cookie-consent-title"
              className={`text-base sm:text-lg font-semibold ${textClass} mb-2`}
            >
              {t('consent.title', { defaultValue: 'We use cookies' })}
            </h3>
            <p
              id="cookie-consent-description"
              className={`text-sm ${subtextClass} leading-relaxed`}
            >
              {t('consent.description', {
                defaultValue:
                  'We use analytics cookies to understand how you use our application and improve your experience. You can choose to accept or decline these cookies.',
              })}
            </p>
            <a
              href="https://docs.worklenz.com/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className={`text-sm ${linkClass} underline mt-2 inline-block`}
            >
              {t('consent.learnMore', { defaultValue: 'Learn more about our privacy policy' })}
            </a>
          </div>

          {/* Actions Section */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto sm:min-w-[280px]">
            <button
              onClick={handleReject}
              className={`px-4 py-2.5 text-sm font-medium rounded-md transition-colors duration-200 ${
                isDarkMode
                  ? 'bg-gray-700 text-gray-200 hover:bg-gray-600 border border-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
              }`}
              aria-label={t('consent.reject', { defaultValue: 'Reject analytics cookies' })}
            >
              {t('consent.rejectButton', { defaultValue: 'Reject' })}
            </button>
            <button
              onClick={handleAccept}
              className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors duration-200"
              aria-label={t('consent.accept', { defaultValue: 'Accept analytics cookies' })}
            >
              {t('consent.acceptButton', { defaultValue: 'Accept' })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CookieConsentBanner;
