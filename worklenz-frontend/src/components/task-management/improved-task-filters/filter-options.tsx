import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DownOutlined, FilterOutlined, Popover } from '@/shared/antd-imports';
import { FilterSection, ThemeClasses } from './types';
import { FilterDropdown } from './filter-dropdown';

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
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    onDropdownClose();
  };

  const hasAnyActiveFilter = appliedFilterCount > 0;

  const isInnerDropdownOpen = Boolean(
    openDropdown && allSections.some(s => s.id === openDropdown)
  );

  const handleClearAll = () => {
    onClearAttributeFilters();
    onDropdownClose();
  };

  const panelContent = (
    <div
      style={{
        width: 'min(480px, calc(100vw - 32px))',
        minHeight: isInnerDropdownOpen ? 260 : 'auto',
      }}
      className="flex flex-col gap-2.5 transition-all duration-150"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-[#303030]">
        <div className="flex items-center gap-1.5">
          <FilterOutlined className={`text-xs ${themeClasses.secondaryText}`} />
          <span className={`text-xs font-semibold ${themeClasses.optionText}`}>
            {t('filters', { defaultValue: 'Filters' })}
          </span>
        </div>
        {hasAnyActiveFilter && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 font-medium cursor-pointer transition-colors"
          >
            {t('clearAll', { defaultValue: 'Clear all' })}
          </button>
        )}
      </div>

      {/* Quick filters hint */}
      {allSections.length > 0 && (
        <div className={`text-[11px] ${themeClasses.secondaryText}`}>
          {t('addFilter', { defaultValue: 'Add a filter' })}
        </div>
      )}

      {/* Filter items row */}
      {allSections.length === 0 ? (
        <div className={`py-4 px-2 text-center text-xs ${themeClasses.secondaryText}`}>
          {t('allFiltersApplied', { defaultValue: 'All filter options applied' })}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {allSections.map((section, index) => (
            <FilterDropdown
              key={section.id}
              section={section}
              onSelectionChange={onSelectionChange}
              isOpen={openDropdown === section.id}
              onToggle={() => onDropdownToggle(section.id)}
              onClose={onDropdownClose}
              themeClasses={themeClasses}
              isDarkMode={isDarkMode}
              dropdownAlign={index >= 3 ? 'right' : 'left'}
              onManageStatus={onManageStatus}
              onManagePhase={onManagePhase}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Popover
      content={panelContent}
      trigger="click"
      placement="bottomLeft"
      open={isOpen}
      onOpenChange={handleOpenChange}
      // Unmount the panel when it closes. antd otherwise keeps a frozen copy of the
      // content mounted while hidden, which leaves an "open" inner FilterDropdown
      // alive with its document mousedown listener still attached. That stale
      // listener closes a promoted toolbar chip on mousedown, so the option click
      // never lands and the chip's value can't be changed.
      destroyOnHidden
      overlayStyle={{ padding: 0 }}
      overlayInnerStyle={{
        padding: '12px 14px',
        borderRadius: 8,
        backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
        border: isDarkMode ? '1px solid #303030' : '1px solid #e5e7eb',
        boxShadow: isDarkMode
          ? '0 6px 16px 0 rgba(0, 0, 0, 0.48)'
          : '0 6px 16px 0 rgba(0, 0, 0, 0.08)',
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
        <DownOutlined
          className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
    </Popover>
  );
};
