import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloseOutlined, SearchOutlined } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { ThemeClasses } from './types';

interface SearchFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  themeClasses: ThemeClasses;
  className?: string;
}

export const SearchFilter: React.FC<SearchFilterProps> = ({
  value,
  onChange,
  placeholder,
  themeClasses,
  className = '',
}) => {
  const { t } = useTranslation('task-list-filters');
  const [isExpanded, setIsExpanded] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
    if (value) {
      setIsExpanded(true);
    }
  }, [value]);

  const handleToggle = useCallback(() => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isExpanded]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onChange(localValue);
    },
    [localValue, onChange]
  );

  const handleClear = useCallback(() => {
    setLocalValue('');
    onChange('');
  }, [onChange]);

  const isDarkMode = useAppSelector(state => state.themeReducer?.mode === 'dark');

  return (
    <div className={`relative ${className}`}>
      {!isExpanded && !value ? (
        <button
          onClick={handleToggle}
          title={t('search', { defaultValue: 'Search' })}
          aria-label={t('search', { defaultValue: 'Search' })}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 ${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText} ${
            themeClasses.containerBg === 'bg-gray-800'
              ? 'focus:ring-offset-gray-900'
              : 'focus:ring-offset-white'
          }`}
        >
          <SearchOutlined className="w-3.5 h-3.5" />
          <span>{t('search', { defaultValue: 'Search' })}</span>
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
          <div className="relative w-full">
            <SearchOutlined className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={localValue}
              onChange={e => setLocalValue(e.target.value)}
              placeholder={
                placeholder || t('searchTasks', { defaultValue: 'Search tasks by name or key...' })
              }
              className={`w-full pr-4 pl-8 py-1 rounded border focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors duration-150 ${
                isDarkMode
                  ? 'bg-gray-700 text-gray-100 placeholder-gray-400 border-gray-600'
                  : 'bg-white text-gray-900 placeholder-gray-400 border-gray-300'
              }`}
            />
            {localValue && (
              <button
                type="button"
                onClick={handleClear}
                className={`absolute right-1.5 top-1/2 transform -translate-y-1/2 transition-colors duration-150 ${
                  isDarkMode
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <CloseOutlined className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200 ${
              isDarkMode
                ? 'text-white bg-gray-600 hover:bg-gray-700'
                : 'text-gray-800 bg-gray-200 hover:bg-gray-300'
            }`}
          >
            {t('search', { defaultValue: 'Search' })}
          </button>
          <button
            type="button"
            onClick={() => {
              setLocalValue('');
              onChange('');
              setIsExpanded(false);
            }}
            className={`px-2.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
              isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {t('cancel', { defaultValue: 'Cancel' })}
          </button>
        </form>
      )}
    </div>
  );
};
