import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { consentManager } from '../utils/consentManager';
import { useAppSelector } from '../hooks/useAppSelector';

/**
 * Cookie Consent Banner Component
 * Displays GDPR-compliant cookie consent banner for EEA/UK/CH users
 * 
 * Features:
 * - Modern gradient UI with smooth animations
 * - Cookie icon and visual indicators
 * - Semi-transparent backdrop for emphasis
 * - Responsive design with hover effects
 * - Links to privacy policy at https://worklenz.com/privacy/
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
    ? 'bg-gradient-to-r from-gray-900 to-gray-800 border-gray-700'
    : 'bg-gradient-to-r from-white to-gray-50 border-gray-300';
  const textClass = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextClass = isDarkMode ? 'text-gray-300' : 'text-gray-700';
  const linkClass = isDarkMode
    ? 'text-blue-400 hover:text-blue-300 hover:underline'
    : 'text-blue-600 hover:text-blue-700 hover:underline';

  return (
    <>
      {/* Backdrop - visible but doesn't block interactions */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-30 z-[9998]"
        style={{ pointerEvents: 'none' }}
      />
      
      {/* Banner */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[9999] p-4 sm:p-6 animate-slide-up"
        role="dialog"
        aria-labelledby="cookie-consent-title"
        aria-describedby="cookie-consent-description"
      >
        <div
          className={`max-w-6xl mx-auto ${bannerBgClass} border-2 rounded-2xl shadow-2xl backdrop-blur-sm`}
        >
          <div className="p-5 sm:p-7">
            <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 items-start sm:items-center justify-between">
              {/* Content Section */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  {/* Cookie Icon */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    isDarkMode ? 'bg-amber-500/20' : 'bg-amber-50'
                  }`}>
                    <svg 
                      className={`w-6 h-6 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} 
                      fill="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path d="M21.598 11.064a1.006 1.006 0 0 0-.854-.172A2.938 2.938 0 0 1 20 11c-1.654 0-3-1.346-3.003-2.938.005-.034.016-.136.017-.17a.998.998 0 0 0-1.254-1.006A2.963 2.963 0 0 1 15 7c-1.654 0-3-1.346-3-3 0-.217.031-.444.099-.716a1 1 0 0 0-1.067-1.236A9.956 9.956 0 0 0 2 12c0 5.514 4.486 10 10 10s10-4.486 10-10c0-.049-.003-.097-.007-.16a1.004 1.004 0 0 0-.395-.776zM8.5 6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-2 8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm2.5-6.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm3.5 6.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
                    </svg>
                  </div>
                  <h3
                    id="cookie-consent-title"
                    className={`text-lg sm:text-xl font-bold ${textClass}`}
                  >
                    {t('consent.title', { defaultValue: 'Cookie Preferences' })}
                  </h3>
                </div>
                
                <p
                  id="cookie-consent-description"
                  className={`text-sm sm:text-base ${subtextClass} leading-relaxed`}
                >
                  {t('consent.description', {
                    defaultValue:
                      'We use analytics cookies to understand how you use our application and improve your experience. You can choose to accept or decline these cookies.',
                  })}
                </p>
                
                <a
                  href="https://worklenz.com/privacy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-sm font-medium ${linkClass} inline-flex items-center gap-1 transition-all`}
                >
                  {t('consent.learnMore', { defaultValue: 'Learn more about our privacy policy' })}
                  <svg 
                    className="w-4 h-4" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
                    />
                  </svg>
                </a>
              </div>

              {/* Actions Section */}
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto sm:min-w-[300px]">
                <button
                  onClick={handleReject}
                  className={`
                    px-6 py-3 text-sm font-semibold rounded-lg 
                    transition-all duration-200 transform hover:scale-105
                    flex items-center justify-center gap-2
                    ${isDarkMode
                      ? 'bg-gray-700/50 text-gray-200 hover:bg-gray-600 border-2 border-gray-600 hover:border-gray-500'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-300 hover:border-gray-400 shadow-sm'
                    }
                  `}
                  aria-label={t('consent.reject', { defaultValue: 'Reject analytics cookies' })}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {t('consent.rejectButton', { defaultValue: 'Reject All' })}
                </button>
                <button
                  onClick={handleAccept}
                  className="
                    px-6 py-3 text-sm font-semibold text-white rounded-lg
                    bg-gradient-to-r from-blue-600 to-blue-700 
                    hover:from-blue-700 hover:to-blue-800
                    transition-all duration-200 transform hover:scale-105
                    shadow-lg hover:shadow-xl
                    flex items-center justify-center gap-2
                  "
                  aria-label={t('consent.accept', { defaultValue: 'Accept analytics cookies' })}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('consent.acceptButton', { defaultValue: 'Accept All' })}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default CookieConsentBanner;
