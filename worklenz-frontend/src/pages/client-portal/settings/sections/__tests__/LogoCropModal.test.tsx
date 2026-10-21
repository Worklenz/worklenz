import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogoCropModal, getCroppedImg } from '../LogoCropModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-image-crop', async importOriginal => {
  const actual = await importOriginal<typeof import('react-image-crop')>();
  return {
    ...actual,
    default: ({
      children,
      onChange,
      onComplete,
      aspect,
      locked,
      ruleOfThirds,
    }: {
      children: React.ReactNode;
      onChange?: (crop: unknown, percentCrop: unknown) => void;
      onComplete?: (crop: unknown, percentCrop: unknown) => void;
      aspect?: number;
      locked?: boolean;
      ruleOfThirds?: boolean;
    }) => (
      <div
        data-testid="mock-react-crop"
        data-aspect={aspect !== undefined ? String(aspect) : 'free'}
        data-locked={String(locked)}
        data-rule-of-thirds={String(ruleOfThirds)}
      >
        {children}
        <button
          type="button"
          data-testid="mock-crop-trigger"
          onClick={() => {
            const pixelCrop = { unit: 'px', x: 10, y: 10, width: 150, height: 150 };
            const percentCrop = { unit: '%', x: 5, y: 5, width: 50, height: 50 };
            onChange?.(pixelCrop, percentCrop);
            onComplete?.(pixelCrop, percentCrop);
          }}
        >
          Simulate Crop Area
        </button>
      </div>
    ),
  };
});

describe('LogoCropModal', () => {
  const defaultProps = {
    open: true,
    imageSrc: 'data:image/png;base64,fakeimagedata',
    aspect: 1,
    onCancel: vi.fn(),
    onCropComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal when open is true and enables gridlines by default', () => {
    render(<LogoCropModal {...defaultProps} />);

    expect(screen.getByText('Crop Logo')).toBeInTheDocument();
    expect(screen.getByText('Apply Crop')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('1:1 Square')).toBeInTheDocument();
    expect(screen.getByText('250x100')).toBeInTheDocument();
    expect(screen.getByTestId('mock-react-crop')).toBeInTheDocument();
    expect(screen.getByTestId('mock-react-crop')).toHaveAttribute('data-rule-of-thirds', 'true');
    expect(screen.getByTestId('mock-react-crop')).toHaveAttribute('data-aspect', '1');
    expect(screen.getByTestId('mock-react-crop')).toHaveAttribute('data-locked', 'false');
    expect(
      screen.getByText('Drag corners or sides to resize · Move selection to reposition')
    ).toBeInTheDocument();
  });

  it('toggles between 1:1 Square and 250x100 aspect ratio and locks 250x100', async () => {
    const user = userEvent.setup();
    render(<LogoCropModal {...defaultProps} />);

    // Initially aspect is 1 and not locked
    expect(screen.getByTestId('mock-react-crop')).toHaveAttribute('data-aspect', '1');
    expect(screen.getByTestId('mock-react-crop')).toHaveAttribute('data-locked', 'false');
    expect(
      screen.getByText('Drag corners or sides to resize · Move selection to reposition')
    ).toBeInTheDocument();

    // Click "250x100"
    const bannerOption = screen.getByText('250x100');
    await user.click(bannerOption);

    // Aspect becomes 2.5 and locked
    expect(screen.getByTestId('mock-react-crop')).toHaveAttribute('data-aspect', '2.5');
    expect(screen.getByTestId('mock-react-crop')).toHaveAttribute('data-locked', 'true');
    expect(screen.getByText('Move selection to reposition')).toBeInTheDocument();

    // Click "1:1 Square"
    const squareOption = screen.getByText('1:1 Square');
    await user.click(squareOption);

    // Aspect changes back to 1 and unlocked
    expect(screen.getByTestId('mock-react-crop')).toHaveAttribute('data-aspect', '1');
    expect(screen.getByTestId('mock-react-crop')).toHaveAttribute('data-locked', 'false');
    expect(
      screen.getByText('Drag corners or sides to resize · Move selection to reposition')
    ).toBeInTheDocument();
  });

  it('does not render modal content when open is false', () => {
    render(<LogoCropModal {...defaultProps} open={false} />);

    expect(screen.queryByText('Crop Logo')).not.toBeInTheDocument();
  });

  it('calls onCancel when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<LogoCropModal {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCropComplete after cropping and clicking Apply Crop', async () => {
    const user = userEvent.setup();
    render(<LogoCropModal {...defaultProps} />);

    // Trigger load on image to populate imgRef
    const img = screen.getByRole('img', { name: 'Crop' });
    Object.defineProperty(img, 'naturalWidth', { value: 300, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 300, configurable: true });
    Object.defineProperty(img, 'width', { value: 300, configurable: true });
    Object.defineProperty(img, 'height', { value: 300, configurable: true });
    fireEvent.load(img);

    // Simulate crop completion
    fireEvent.click(screen.getByTestId('mock-crop-trigger'));

    // Mock canvas context
    const originalCreateElement = document.createElement.bind(document);
    const mockToDataURL = vi.fn().mockReturnValue('data:image/png;base64,croppedresult');
    const mockDrawImage = vi.fn();

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            drawImage: mockDrawImage,
          }),
          toDataURL: mockToDataURL,
        } as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName);
    });

    try {
      const applyButton = screen.getByRole('button', { name: 'Apply Crop' });
      await user.click(applyButton);

      await waitFor(() => {
        expect(defaultProps.onCropComplete).toHaveBeenCalledWith(
          'data:image/png;base64,croppedresult'
        );
      });
    } finally {
      vi.restoreAllMocks();
    }
  });

  describe('getCroppedImg', () => {
    it('scales dimensions down when crop area exceeds 512px', async () => {
      let canvasWidth = 0;
      let canvasHeight = 0;
      let drawArgs: unknown[] = [];

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'canvas') {
          return {
            set width(val: number) {
              canvasWidth = val;
            },
            get width() {
              return canvasWidth;
            },
            set height(val: number) {
              canvasHeight = val;
            },
            get height() {
              return canvasHeight;
            },
            getContext: () => ({
              drawImage: (...args: unknown[]) => {
                drawArgs = args;
              },
            }),
            toDataURL: () => 'data:image/png;base64,scaled',
          } as unknown as HTMLCanvasElement;
        }
        return originalCreateElement(tagName);
      });

      const originalImage = window.Image;
      class MockImage {
        onload: (() => void) | null = null;
        src = '';
        width = 1024;
        height = 1024;
        naturalWidth = 1024;
        naturalHeight = 1024;
        addEventListener(event: string, callback: () => void) {
          if (event === 'load') setTimeout(callback, 0);
        }
      }
      window.Image = MockImage as unknown as typeof Image;

      try {
        const result = await getCroppedImg('data:image/png;base64,large', {
          x: 0,
          y: 0,
          width: 1024,
          height: 1024,
        });

        expect(result).toBe('data:image/png;base64,scaled');
        expect(canvasWidth).toBe(512);
        expect(canvasHeight).toBe(512);
        expect(drawArgs[7]).toBe(512);
        expect(drawArgs[8]).toBe(512);
      } finally {
        window.Image = originalImage;
        vi.restoreAllMocks();
      }
    });

    it('does not upscale when crop area is smaller than 512px', async () => {
      let canvasWidth = 0;
      let canvasHeight = 0;

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'canvas') {
          return {
            set width(val: number) {
              canvasWidth = val;
            },
            get width() {
              return canvasWidth;
            },
            set height(val: number) {
              canvasHeight = val;
            },
            get height() {
              return canvasHeight;
            },
            getContext: () => ({
              drawImage: vi.fn(),
            }),
            toDataURL: () => 'data:image/png;base64,original',
          } as unknown as HTMLCanvasElement;
        }
        return originalCreateElement(tagName);
      });

      const originalImage = window.Image;
      class MockImage {
        onload: (() => void) | null = null;
        src = '';
        width = 250;
        height = 250;
        naturalWidth = 250;
        naturalHeight = 250;
        addEventListener(event: string, callback: () => void) {
          if (event === 'load') setTimeout(callback, 0);
        }
      }
      window.Image = MockImage as unknown as typeof Image;

      try {
        await getCroppedImg('data:image/png;base64,small', {
          x: 0,
          y: 0,
          width: 250,
          height: 250,
        });

        expect(canvasWidth).toBe(250);
        expect(canvasHeight).toBe(250);
      } finally {
        window.Image = originalImage;
        vi.restoreAllMocks();
      }
    });

    it('scales dimensions directly to targetDimensions when provided', async () => {
      let canvasWidth = 0;
      let canvasHeight = 0;

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'canvas') {
          return {
            set width(val: number) {
              canvasWidth = val;
            },
            get width() {
              return canvasWidth;
            },
            set height(val: number) {
              canvasHeight = val;
            },
            get height() {
              return canvasHeight;
            },
            getContext: () => ({
              drawImage: vi.fn(),
            }),
            toDataURL: () => 'data:image/png;base64,exact250x100',
          } as unknown as HTMLCanvasElement;
        }
        return originalCreateElement(tagName);
      });

      const originalImage = window.Image;
      class MockImage {
        onload: (() => void) | null = null;
        src = '';
        width = 800;
        height = 320;
        naturalWidth = 800;
        naturalHeight = 320;
        addEventListener(event: string, callback: () => void) {
          if (event === 'load') setTimeout(callback, 0);
        }
      }
      window.Image = MockImage as unknown as typeof Image;

      try {
        const result = await getCroppedImg(
          'data:image/png;base64,banner',
          { x: 0, y: 0, width: 800, height: 320 },
          512,
          { width: 250, height: 100 }
        );

        expect(result).toBe('data:image/png;base64,exact250x100');
        expect(canvasWidth).toBe(250);
        expect(canvasHeight).toBe(100);
      } finally {
        window.Image = originalImage;
        vi.restoreAllMocks();
      }
    });
  });
});
