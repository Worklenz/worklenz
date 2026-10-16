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

vi.mock('react-easy-crop', () => ({
  default: ({
    image,
    showGrid,
    onCropComplete,
  }: {
    image: string;
    showGrid?: boolean;
    onCropComplete: (area: unknown, pixels: unknown) => void;
  }) => (
    <div data-testid="mock-cropper" data-image={image} data-show-grid={String(showGrid)}>
      <button
        type="button"
        data-testid="mock-crop-trigger"
        onClick={() =>
          onCropComplete(
            { x: 0, y: 0, width: 100, height: 100 },
            { x: 10, y: 10, width: 150, height: 150 }
          )
        }
      >
        Simulate Crop Area
      </button>
    </div>
  ),
}));

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
    expect(screen.getByTestId('mock-cropper')).toBeInTheDocument();
    expect(screen.getByTestId('mock-cropper')).toHaveAttribute('data-image', defaultProps.imageSrc);
    expect(screen.getByTestId('mock-cropper')).toHaveAttribute('data-show-grid', 'true');
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

    // Simulate react-easy-crop completing a crop area
    fireEvent.click(screen.getByTestId('mock-crop-trigger'));

    // Mock canvas context and image load
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

    // Mock Image
    const originalImage = window.Image;
    class MockImage {
      onload: (() => void) | null = null;
      src = '';
      addEventListener(event: string, callback: () => void) {
        if (event === 'load') {
          setTimeout(callback, 0);
        }
      }
    }
    window.Image = MockImage as unknown as typeof Image;

    try {
      const applyButton = screen.getByRole('button', { name: 'Apply Crop' });
      await user.click(applyButton);

      await waitFor(() => {
        expect(defaultProps.onCropComplete).toHaveBeenCalledWith('data:image/png;base64,croppedresult');
      });
    } finally {
      window.Image = originalImage;
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
  });
});
