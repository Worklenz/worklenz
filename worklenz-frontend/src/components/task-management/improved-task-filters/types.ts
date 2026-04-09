import React from 'react';

export interface FilterOption {
  id: string;
  label: string;
  value: string;
  color?: string;
  avatar?: string;
  count?: number;
  selected?: boolean;
}

export interface FilterSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  options: FilterOption[];
  selectedValues: string[];
  multiSelect: boolean;
  searchable?: boolean;
}

export interface ThemeClasses {
  containerBg: string;
  containerBorder: string;
  buttonBg: string;
  buttonBorder: string;
  buttonText: string;
  dropdownBg: string;
  dropdownBorder: string;
  optionText: string;
  optionHover: string;
  secondaryText: string;
  dividerBorder: string;
  pillBg: string;
  pillText: string;
  pillActiveBg: string;
  pillActiveText: string;
  searchBg: string;
  searchBorder: string;
  searchText: string;
}

export interface ImprovedTaskFiltersProps {
  position: 'board' | 'list';
  className?: string;
}
