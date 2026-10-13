import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from 'i18next';
import { theme } from 'antd';
import { CsvMappingStepsContent } from './CsvMappingStepsContent';
import { WORKLENZ_STATUS_DOCS_URL } from '@/shared/help-links-constants';
import type { ThemeToken, TranslateFn } from '../types';

describe('CsvMappingStepsContent - Step 3 (Map statuses)', () => {
  const testI18n = i18n.createInstance();
  testI18n.init({
    lng: 'en',
    resources: {},
  });
  const mockTranslate: TranslateFn = testI18n.t;
  const mockThemeToken: ThemeToken = theme.getDesignToken();

  const defaultProps = {
    step: 3,
    t: mockTranslate,
    themeToken: mockThemeToken,
    csvColumns: ['Title', 'Status'],
    fieldMappings: { Title: 'name', Status: 'status' },
    setFieldMappings: vi.fn(),
    includeInImport: { Title: true, Status: true },
    setIncludeInImport: vi.fn(),
    worklenzFieldOptions: [
      { value: 'name', label: 'Task Name' },
      { value: 'status', label: 'Status' },
    ],
    statusValues: ['To Do', 'In Progress', 'Done'],
    searchValue: '',
    setSearchValue: vi.fn(),
    filter: 'all',
    setFilter: vi.fn(),
    statusColumnKey: 'Status',
    statusOptions: [
      { key: 'status-1', label: 'To Do', icon: null, level: 1 },
      { key: 'status-2', label: 'Done', icon: null, level: 2 },
    ],
    statusValueMapping: {},
    setStatusValueMapping: vi.fn(),
    pendingNewStatuses: {},
    setPendingNewStatuses: vi.fn(),
    statusCategories: [
      { id: 'cat-1', name: 'To Do' },
      { id: 'cat-2', name: 'Done' },
    ],
    csvUserRows: [],
    userEmails: {},
    setUserEmails: vi.fn(),
    addUsers: false,
    setAddUsers: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Read about mapping statuses" link with WORKLENZ_STATUS_DOCS_URL and not the blog', () => {
    render(<CsvMappingStepsContent {...defaultProps} />);

    const link = screen.getByRole('link', { name: /Read about mapping statuses/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', WORKLENZ_STATUS_DOCS_URL);
    expect(link.getAttribute('href')).not.toBe('https://worklenz.com/blog/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('opens mapping statuses info modal when the link is clicked', async () => {
    render(<CsvMappingStepsContent {...defaultProps} />);

    // Initially modal is not open
    expect(screen.queryByText('About Mapping Statuses')).not.toBeInTheDocument();

    const link = screen.getByRole('link', { name: /Read about mapping statuses/i });
    fireEvent.click(link);

    // After clicking, modal should be opened displaying details
    expect(screen.getByText('About Mapping Statuses')).toBeInTheDocument();
    expect(screen.getByText('1. Worklenz Status Categories')).toBeInTheDocument();

    // Closing the modal works
    const gotItButton = screen.getByRole('button', { name: /Got It/i });
    fireEvent.click(gotItButton);
    await waitFor(() => expect(screen.queryByText('About Mapping Statuses')).not.toBeInTheDocument());
  });
});
