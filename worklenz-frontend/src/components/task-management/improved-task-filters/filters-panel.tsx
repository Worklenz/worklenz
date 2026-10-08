import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Avatar,
  CheckOutlined,
  CloseOutlined,
  DownOutlined,
  FilterOutlined,
  Popover,
  SearchOutlined,
  SettingOutlined,
} from '@/shared/antd-imports';
import { AvatarNamesMap } from '@/shared/constants';
import { useAuthService } from '@/hooks/useAuth';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import { FilterOption, FilterSection, ThemeClasses } from './types';

interface FilterOptionsProps {
  allSections: FilterSection[];
  appliedFilterCount: number;
  openDropdown: string | null;
  onDropdownToggle: (sectionId: string) => void;
  onDropdownClose: () => void;
  onSelectionChange: (sectionId: string, values: string[]) => void;
  themeClasses: ThemeClasses;
  isDarkMode: boolean;
  onClearAttributeFilters: () => void;
  onManageStatus?: () => void;
  onManagePhase?: () => void;
  className?: string;
}

/**
 * "Filters" group.
 *
 * Every attribute filter is picked from inside this panel - nothing is promoted
 * out into the toolbar. Sections expand inline (accordion) instead of opening a
 * nested dropdown, which keeps the panel readable, avoids popover overlap bugs
 * and works on narrow screens.
 */
export const Filters: React.FC<FilterOptionsProps> = ({
  allSections,
  appliedFilterCount,
  openDropdown,
  onDropdownToggle,
  onDropdownClose,
  onSelectionChange,
  themeClasses,
  isDarkMode,
  onClearAttributeFilters,
  onManageStatus,
  onManagePhase,
  className = '',
}) => {
  const { t } = useTranslation('task-list-filters');
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  const isProjectManager = useIsProjectManager();
  const canConfigure = isOwnerOrAdmin || isProjectManager;

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    // Collapse any expanded section whenever the panel opens or closes.
    onDropdownClose();
    if (!open) {
      setSearchTerms({});
    }
  };

  const sections = useMemo(
    () =>
      allSections.map(section => {
        const term = (searchTerms[section.id] || '').trim().toLowerCase();
        const matches =
          term && section.searchable
            ? section.options.filter(option => option.label.toLowerCase().includes(term))
            : section.options;

        // Keep selected options on top while preserving the natural order.
        const orderedOptions = [...matches].sort(
          (a, b) =>
            Number(section.selectedValues.includes(b.value)) -
            Number(section.selectedValues.includes(a.value))
        );

        return { section, orderedOptions, hasSearchTerm: Boolean(term) };
      }),
    [allSections, searchTerms]
  );

  const handleOptionToggle = (section: FilterSection, optionValue: string) => {
    if (!section.multiSelect) {
      onSelectionChange(section.id, [optionValue]);
      return;
    }

    const newValues = section.selectedValues.includes(optionValue)
      ? section.selectedValues.filter(value => value !== optionValue)
      : [...section.selectedValues, optionValue];

    onSelectionChange(section.id, newValues);
  };

  const summaryFor = (section: FilterSection) => {
    const count = section.selectedValues.length;
    if (count === 0) return null;

    if (count === 1) {
      const label = section.options.find(
        option => option.value === section.selectedValues[0]
      )?.label;
      if (label) return label;
    }

    return t('selectedCount', {
      count,
      label: section.label,
      defaultValue: '{{label}}: {{count}} selected',
    });
  };

  const manageActionFor = (sectionId: string) => {
    if (!canConfigure) return null;

    if (sectionId === 'status' && onManageStatus) {
      return {
        label: t('manageStatuses', { defaultValue: 'Manage Statuses' }),
        onClick: onManageStatus,
      };
    }

    if (sectionId === 'phase' && onManagePhase) {
      return {
        label: `${t('manage', { defaultValue: 'Manage' })} ${t('phasesText', {
          defaultValue: 'Phases',
        })}`,
        onClick: onManagePhase,
      };
    }

    return null;
  };

  const panelContent = (
    <div
      style={{ width: 'min(300px, calc(100vw - 32px))' }}
      className="flex flex-col"
      onKeyDown={event => {
        if (event.key === 'Escape') {
          onDropdownClose();
          setIsOpen(false);
        }
      }}
    >
      <div
        className={`flex items-center justify-between pb-2 mb-1 border-b ${themeClasses.dividerBorder}`}
      >
        <div className="flex items-center gap-1.5">
          <FilterOutlined className={`text-xs ${themeClasses.secondaryText}`} />
          <span className={`text-xs font-semibold ${themeClasses.optionText}`}>
            {t('filters', { defaultValue: 'Filters' })}
          </span>
          {appliedFilterCount > 0 && (
            <span
              className={`inline-flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-bold rounded-full ${
                isDarkMode ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-800'
              }`}
            >
              {appliedFilterCount}
            </span>
          )}
        </div>

        {appliedFilterCount > 0 && (
          <button
            type="button"
            onClick={() => {
              onClearAttributeFilters();
              onDropdownClose();
            }}
            className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 font-medium cursor-pointer transition-colors"
          >
            {t('clearAll', { defaultValue: 'Clear all' })}
          </button>
        )}
      </div>

      <div className="flex flex-col max-h-[60vh] overflow-y-auto">
        {sections.length === 0 ? (
          <div className={`py-4 px-2 text-center text-xs ${themeClasses.secondaryText}`}>
            {t('noFiltersAvailable', { defaultValue: 'No filters available' })}
          </div>
        ) : (
          sections.map(({ section, orderedOptions, hasSearchTerm }) => {
            const isExpanded = openDropdown === section.id;
            const summary = summaryFor(section);
            const hasSelection = section.selectedValues.length > 0;
            const manageAction = manageActionFor(section.id);
            const SectionIcon = section.icon;

            return (
              <div key={section.id} className="border-b border-transparent last:border-b-0">
                <button
                  type="button"
                  onClick={() => onDropdownToggle(section.id)}
                  aria-expanded={isExpanded}
                  className={`w-full min-h-9 flex items-center gap-2 px-1.5 py-2 text-xs rounded-md text-left transition-colors duration-150 ${themeClasses.optionText} ${themeClasses.optionHover}`}
                >
                  <SectionIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-medium shrink-0">{section.label}</span>
                  {summary && (
                    <span
                      className={`ml-auto truncate max-w-[52%] text-right ${themeClasses.secondaryText}`}
                    >
                      {summary}
                    </span>
                  )}
                  <DownOutlined
                    className={`w-3 h-3 shrink-0 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180' : ''
                    } ${summary ? '' : 'ml-auto'} ${themeClasses.secondaryText}`}
                  />
                </button>

                {isExpanded && (
                  <div className="pb-2 px-1.5">
                    {section.searchable && (
                      <div className="relative w-full mb-1.5">
                        <SearchOutlined className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          value={searchTerms[section.id] || ''}
                          onChange={event =>
                            setSearchTerms(previous => ({
                              ...previous,
                              [section.id]: event.target.value,
                            }))
                          }
                          placeholder={t('search', { defaultValue: 'Search' })}
                          aria-label={`${t('search', { defaultValue: 'Search' })} - ${
                            section.label
                          }`}
                          className={`w-full pl-8 pr-2 py-1 text-xs rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-150 ${
                            isDarkMode
                              ? 'bg-gray-700 text-gray-100 placeholder-gray-400 border-gray-600'
                              : 'bg-white text-gray-900 placeholder-gray-400 border-gray-300'
                          }`}
                        />
                      </div>
                    )}

                    {orderedOptions.length === 0 ? (
                      <div
                        className={`flex items-center justify-between gap-2 px-2 py-2 text-xs ${themeClasses.secondaryText}`}
                      >
                        <span>{t('noOptionsFound', { defaultValue: 'No options found' })}</span>
                        {!hasSearchTerm && manageAction && (
                          <button
                            type="button"
                            onClick={manageAction.onClick}
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400"
                          >
                            <SettingOutlined className="w-3 h-3" />
                            {manageAction.label}
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div
                          role="group"
                          aria-label={section.label}
                          className="flex flex-col gap-0.5 max-h-52 overflow-y-auto"
                        >
                          {orderedOptions.map(option => (
                            <OptionRow
                              key={option.id}
                              option={option}
                              sectionId={section.id}
                              isSelected={section.selectedValues.includes(option.value)}
                              isDarkMode={isDarkMode}
                              themeClasses={themeClasses}
                              onToggle={value => handleOptionToggle(section, value)}
                            />
                          ))}
                        </div>

                        <div className="flex items-center justify-end gap-3 mt-1.5 px-1">
                          {section.multiSelect && (
                            <button
                              type="button"
                              onClick={() =>
                                onSelectionChange(
                                  section.id,
                                  section.options.map(option => option.value)
                                )
                              }
                              className="text-[11px] font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400"
                            >
                              {t('selectAll', { defaultValue: 'Select all' })}
                            </button>
                          )}
                          {hasSelection && (
                            <button
                              type="button"
                              onClick={() => onSelectionChange(section.id, [])}
                              className={`text-[11px] font-medium ${themeClasses.secondaryText} hover:underline`}
                            >
                              {t('clear', { defaultValue: 'Clear' })}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <Popover
      content={panelContent}
      trigger="click"
      placement="bottomLeft"
      open={isOpen}
      onOpenChange={handleOpenChange}
      // Unmount on close: antd otherwise keeps a frozen copy of the content
      // mounted while hidden (and of anything that was "open" inside it).
      destroyOnHidden
      styles={{
        root: { padding: 0 },
        body: {
          padding: '12px 14px',
          borderRadius: 8,
          backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
          border: `1px solid ${isDarkMode ? '#303030' : '#e5e7eb'}`,
          boxShadow: isDarkMode
            ? '0 6px 16px 0 rgba(0, 0, 0, 0.48)'
            : '0 6px 16px 0 rgba(0, 0, 0, 0.08)',
        },
      }}
    >
      <button
        type="button"
        aria-label={
          appliedFilterCount > 0
            ? `${t('filters', { defaultValue: 'Filters' })} (${appliedFilterCount})`
            : t('filters', { defaultValue: 'Filters' })
        }
        aria-expanded={isOpen}
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md
          border transition-all duration-200 ease-in-out
          ${themeClasses.buttonBg} ${themeClasses.buttonBorder} ${themeClasses.buttonText}
          hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
          ${isDarkMode ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'}
          ${className}
        `}
      >
        <FilterOutlined className="w-3.5 h-3.5" />
        <span>{t('filters', { defaultValue: 'Filters' })}</span>
        {appliedFilterCount > 0 && (
          <span
            aria-hidden="true"
            className={`inline-flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-bold rounded-full ${
              isDarkMode ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-800'
            }`}
          >
            {appliedFilterCount}
          </span>
        )}
        {appliedFilterCount > 0 && (
          <span
            role="button"
            tabIndex={0}
            title={t('clearAll', { defaultValue: 'Clear all' })}
            aria-label={t('clearAll', { defaultValue: 'Clear all' })}
            onClick={event => {
              event.stopPropagation();
              onClearAttributeFilters();
              onDropdownClose();
            }}
            onMouseDown={event => event.stopPropagation()}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onClearAttributeFilters();
                onDropdownClose();
              }
            }}
            className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-red-500 hover:text-red-600 dark:text-red-400 cursor-pointer transition-colors duration-150"
          >
            <CloseOutlined className="w-3 h-3" />
          </span>
        )}
      </button>
    </Popover>
  );
};

interface OptionRowProps {
  option: FilterOption;
  sectionId: string;
  isSelected: boolean;
  isDarkMode: boolean;
  themeClasses: ThemeClasses;
  onToggle: (value: string) => void;
}

const OptionRow: React.FC<OptionRowProps> = ({
  option,
  sectionId,
  isSelected,
  isDarkMode,
  themeClasses,
  onToggle,
}) => {
  const initial = option.label[0]?.toUpperCase() || '?';

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isSelected}
      onClick={() => onToggle(option.value)}
      className={`
        w-full min-h-8 flex items-center gap-2 px-2 py-1.5 text-xs rounded
        transition-colors duration-150 text-left
        ${
          isSelected
            ? isDarkMode
              ? 'bg-gray-700 text-white'
              : 'bg-gray-100 text-gray-900 font-semibold'
            : `${themeClasses.optionText} ${themeClasses.optionHover}`
        }
      `}
    >
      <span
        aria-hidden="true"
        className={`
          flex items-center justify-center w-3.5 h-3.5 border rounded shrink-0
          ${
            isSelected
              ? 'bg-gray-600 border-gray-700 text-white'
              : 'border-gray-300 dark:border-gray-600'
          }
        `}
      >
        {isSelected && <CheckOutlined className="w-2.5 h-2.5" />}
      </span>

      {sectionId === 'assignees' &&
        (option.avatar ? (
          <Avatar src={option.avatar} alt={option.label} size={20} />
        ) : (
          <Avatar
            size={20}
            style={{
              backgroundColor: AvatarNamesMap[initial] || '#9e9e9e',
              fontSize: 10,
            }}
          >
            {initial}
          </Avatar>
        ))}

      {option.color && (
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: option.color }}
        />
      )}

      <span className="flex-1 truncate">{option.label}</span>

      {option.count !== undefined && (
        <span className="text-xs text-gray-500 dark:text-gray-400">{option.count}</span>
      )}
    </button>
  );
};
