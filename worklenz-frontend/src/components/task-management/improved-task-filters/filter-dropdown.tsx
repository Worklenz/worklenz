import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Avatar,
  CheckOutlined,
  DownOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@/shared/antd-imports';
import { AvatarNamesMap } from '@/shared/constants';
import { useAuthService } from '@/hooks/useAuth';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import { FilterSection, ThemeClasses } from './types';

interface FilterDropdownProps {
  section: FilterSection;
  onSelectionChange: (sectionId: string, values: string[]) => void;
  isOpen: boolean;
  onToggle: () => void;
  themeClasses: ThemeClasses;
  isDarkMode: boolean;
  className?: string;
  onManageStatus?: () => void;
  onManagePhase?: () => void;
  projectPhaseLabel?: string;
}

export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  section,
  onSelectionChange,
  isOpen,
  onToggle,
  themeClasses,
  isDarkMode,
  className = '',
  onManageStatus,
  onManagePhase,
  projectPhaseLabel,
}) => {
  const { t } = useTranslation('task-list-filters');
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  const isProjectManager = useIsProjectManager();
  const canConfigure = isOwnerOrAdmin || isProjectManager;
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(section.options);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptionsMemo = useMemo(() => {
    if (!section.searchable || !searchTerm.trim()) {
      return section.options;
    }

    const searchLower = searchTerm.toLowerCase();
    return section.options.filter(option => option.label.toLowerCase().includes(searchLower));
  }, [searchTerm, section.options, section.searchable]);

  useEffect(() => {
    setFilteredOptions(filteredOptionsMemo);
  }, [filteredOptionsMemo]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (isOpen) onToggle();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onToggle]);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const buttonTitle = useMemo(() => {
    if (section.id === 'groupBy' && section.selectedValues[0]) {
      const selectedOpt = section.options.find(o => o.value === section.selectedValues[0]);
      if (selectedOpt?.label) {
        return t('groupBySelected', {
          label: section.label,
          value: selectedOpt.label,
          defaultValue: '{{label}}: {{value}}',
        });
      }
      return section.label;
    }

    if (section.id !== 'groupBy' && section.selectedValues.length > 0) {
      return t('selectedCount', {
        count: section.selectedValues.length,
        label: section.label,
        defaultValue: '{{label}}: {{count}} selected',
      });
    }

    return section.label;
  }, [section, t]);

  const handleOptionToggle = useCallback(
    (optionValue: string) => {
      if (section.multiSelect) {
        const newValues = section.selectedValues.includes(optionValue)
          ? section.selectedValues.filter(v => v !== optionValue)
          : [...section.selectedValues, optionValue];
        onSelectionChange(section.id, newValues);
        return;
      }

      onSelectionChange(section.id, [optionValue]);
      onToggle();
    },
    [section, onSelectionChange, onToggle]
  );

  const selectedCount = section.selectedValues.length;
  const IconComponent = section.icon;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={onToggle}
        title={buttonTitle}
        aria-label={buttonTitle}
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md
          border transition-all duration-200 ease-in-out
          ${
            selectedCount > 0
              ? isDarkMode
                ? 'bg-gray-600 text-white border-gray-500'
                : 'bg-gray-200 text-gray-800 border-gray-300 font-semibold'
              : `${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText}`
          }
          hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
          ${isDarkMode ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'}
        `}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <IconComponent className="w-3.5 h-3.5" />
        <span>{section.label}</span>
        {section.id === 'groupBy' && selectedCount > 0 && (
          <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {section.options.find(opt => opt.value === section.selectedValues[0])?.label}
          </span>
        )}
        {section.id !== 'groupBy' && selectedCount > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-gray-500 rounded-full">
            {selectedCount}
          </span>
        )}
        <DownOutlined
          className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {section.id === 'groupBy' && canConfigure && (
        <div className="inline-flex items-center gap-1 ml-2">
          {section.selectedValues[0] === 'phase' && (
            <button
              onClick={onManagePhase}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border-2 transition-all duration-200 ease-in-out hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isDarkMode
                  ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500 focus:ring-offset-gray-900'
                  : 'bg-blue-500 hover:bg-blue-600 text-white border-blue-600 focus:ring-offset-white'
              }`}
            >
              <SettingOutlined className="w-3.5 h-3.5" />
              {t('manage', { defaultValue: 'Manage' })}{' '}
              {projectPhaseLabel || t('phasesText', { defaultValue: 'Phases' })}
            </button>
          )}
          {section.selectedValues[0] === 'status' && (
            <button
              onClick={onManageStatus}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border-2 transition-all duration-200 ease-in-out hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isDarkMode
                  ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500 focus:ring-offset-gray-900'
                  : 'bg-blue-500 hover:bg-blue-600 text-white border-blue-600 focus:ring-offset-white'
              }`}
            >
              <SettingOutlined className="w-3.5 h-3.5" />
              {t('manageStatuses', { defaultValue: 'Manage Statuses' })}
            </button>
          )}
        </div>
      )}

      {isOpen && (
        <div
          className={`absolute top-full left-0 z-50 mt-1 w-64 ${themeClasses.dropdownBg} rounded-md shadow-sm border ${themeClasses.dropdownBorder}`}
        >
          {section.searchable && (
            <div className={`p-2 border-b ${themeClasses.dividerBorder}`}>
              <div className="relative w-full">
                <SearchOutlined className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder={t('search', { defaultValue: 'Search' })}
                  className={`w-full pl-8 pr-2 py-1 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-150 ${
                    isDarkMode
                      ? 'bg-gray-700 text-gray-100 placeholder-gray-400 border-gray-600'
                      : 'bg-white text-gray-900 placeholder-gray-400 border-gray-300'
                  }`}
                />
              </div>
            </div>
          )}

          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className={`p-2 text-xs text-center ${themeClasses.secondaryText}`}>
                {t('noOptionsFound', { defaultValue: 'No options found' })}
              </div>
            ) : (
              <div className="p-0.5">
                {filteredOptions.map(option => {
                  const isSelected = section.selectedValues.includes(option.value);

                  return (
                    <button
                      key={option.id}
                      onClick={() => handleOptionToggle(option.value)}
                      className={`
                        w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded
                        transition-colors duration-150 text-left
                        ${
                          isSelected
                            ? isDarkMode
                              ? 'bg-gray-600 text-white'
                              : 'bg-gray-200 text-gray-800 font-semibold'
                            : `${themeClasses.optionText} ${themeClasses.optionHover}`
                        }
                      `}
                    >
                      {section.id !== 'groupBy' && (
                        <div
                          className={`
                            flex items-center justify-center w-3.5 h-3.5 border rounded
                            ${
                              isSelected
                                ? 'bg-gray-600 border-gray-800 text-white'
                                : 'border-gray-300 dark:border-gray-600'
                            }
                          `}
                        >
                          {isSelected && <CheckOutlined className="w-2.5 h-2.5" />}
                        </div>
                      )}

                      {option.color && (
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: option.color }}
                        />
                      )}

                      {section.id === 'assignees' && (
                        <div className="flex-shrink-0">
                          {option.avatar ? (
                            <Avatar
                              src={option.avatar}
                              alt={option.label}
                              size={20}
                              style={{ width: 20, height: 20 }}
                            />
                          ) : (
                            <Avatar
                              size={20}
                              style={{
                                backgroundColor:
                                  AvatarNamesMap[option.label[0]?.toUpperCase()] || '#9e9e9e',
                                width: 20,
                                height: 20,
                                fontSize: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {option.label[0]?.toUpperCase()}
                            </Avatar>
                          )}
                        </div>
                      )}

                      <div className="flex-1 flex items-center justify-between">
                        <span className="truncate">{option.label}</span>
                        {option.count !== undefined && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {option.count}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
