import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloseOutlined, Input, InputRef, SearchOutlined, theme } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { ThemeClasses } from './types';

interface SearchFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  themeClasses: ThemeClasses;
  className?: string;
  /** `inline` is an always-visible live search box that "/" focuses. */
  variant?: 'collapsible' | 'inline';
}

export const SearchFilter: React.FC<SearchFilterProps> = ({ variant = 'collapsible', ...props }) =>
  variant === 'inline' ? <InlineSearchFilter {...props} /> : <CollapsibleSearchFilter {...props} />;

const InlineSearchFilter = ({
  value,
  onChange,
  placeholder,
  className = '',
}: Omit<SearchFilterProps, 'variant'>) => {
  const { t } = useTranslation('task-list-filters');
  const { token } = theme.useToken();
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<InputRef>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableElement(document.activeElement)) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(
    () => () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    },
    []
  );

  const commitValue = useCallback(
    (nextValue: string) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      if (nextValue.trim() === value.trim()) return;
      onChange(nextValue.trim());
    },
    [onChange, value]
  );

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setLocalValue(nextValue);
    if (!nextValue) {
      commitValue('');
      return;
    }
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => commitValue(nextValue), INLINE_SEARCH_DEBOUNCE_MS);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      commitValue(localValue);
      return;
    }
    if (event.key === 'Escape') {
      setLocalValue('');
      commitValue('');
      inputRef.current?.blur();
    }
  };

  const label = placeholder || t('searchWork', { defaultValue: 'Search work…' });

  return (
    <Input
      ref={inputRef}
      size="small"
      value={localValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={label}
      aria-label={label}
      allowClear
      prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
      suffix={
        !localValue && (
          <kbd
            className="rounded px-1 text-[11px] leading-4"
            style={{
              border: `1px solid ${token.colorBorder}`,
              color: token.colorTextTertiary,
            }}
            title={t('searchShortcutHint', { defaultValue: 'Press / to search' })}
          >
            /
          </kbd>
        )
      }
      className={`w-full sm:w-[240px] ${className}`}
      style={{ height: 30 }}
    />
  );
};

const isEditableElement = (element: Element | null) => {
  if (!element) return false;
  if (element instanceof HTMLElement && element.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);
};

const INLINE_SEARCH_DEBOUNCE_MS = 300;

const CollapsibleSearchFilter = ({
  value,
  onChange,
  placeholder,
  themeClasses,
  className = '',
}: Omit<SearchFilterProps, 'variant'>) => {
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
