import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MappingStatusesInfoModal } from './MappingStatusesInfoModal';
import { WORKLENZ_STATUS_DOCS_URL } from '@/shared/help-links-constants';

describe('MappingStatusesInfoModal', () => {
  const mockTranslate = vi.fn(
    (key: string, options?: { defaultValue?: string } | string) => {
      if (typeof options === 'string') return options;
      return options?.defaultValue ?? key;
    }
  );

  const mockThemeToken = {
    colorText: '#000000',
    colorTextSecondary: '#666666',
    colorTextTertiary: '#999999',
    colorPrimary: '#1890ff',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#f5f5f5',
    colorBorder: '#d9d9d9',
    colorBorderSecondary: '#f0f0f0',
    colorSuccess: '#52c41a',
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal content when open is true', () => {
    render(
      <MappingStatusesInfoModal
        open={true}
        onClose={vi.fn()}
        t={mockTranslate}
        themeToken={mockThemeToken}
      />
    );

    expect(screen.getByText('About Mapping Statuses')).toBeInTheDocument();
    expect(screen.getByText(/Status mapping matches the status values found in your CSV file/i)).toBeInTheDocument();
    expect(screen.getByText('1. Worklenz Status Categories')).toBeInTheDocument();
    expect(screen.getByText('2. Map to Existing Statuses')).toBeInTheDocument();
    expect(screen.getByText('3. Create New Custom Statuses')).toBeInTheDocument();
    expect(screen.getByText('4. Unmapped Statuses')).toBeInTheDocument();
  });

  it('calls onClose when Got It button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <MappingStatusesInfoModal
        open={true}
        onClose={handleClose}
        t={mockTranslate}
        themeToken={mockThemeToken}
      />
    );

    const gotItButton = screen.getByRole('button', { name: /Got It/i });
    fireEvent.click(gotItButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('opens documentation page in new window when Read Status Documentation is clicked', () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <MappingStatusesInfoModal
        open={true}
        onClose={vi.fn()}
        t={mockTranslate}
        themeToken={mockThemeToken}
      />
    );

    const docsButton = screen.getByRole('button', { name: /Read Status Documentation/i });
    fireEvent.click(docsButton);

    expect(windowOpenSpy).toHaveBeenCalledWith(
      WORKLENZ_STATUS_DOCS_URL,
      '_blank',
      'noopener,noreferrer'
    );

    windowOpenSpy.mockRestore();
  });

  it('does not render modal content when open is false', () => {
    render(
      <MappingStatusesInfoModal
        open={false}
        onClose={vi.fn()}
        t={mockTranslate}
        themeToken={mockThemeToken}
      />
    );

    expect(screen.queryByText('About Mapping Statuses')).not.toBeInTheDocument();
  });
});
