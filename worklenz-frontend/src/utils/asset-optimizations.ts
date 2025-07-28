// Asset optimization utilities for improved performance

// Image optimization constants
export const IMAGE_OPTIMIZATION = {
  // Quality settings for different use cases
  QUALITY: {
    THUMBNAIL: 70,
    AVATAR: 80,
    CONTENT: 85,
    HIGH_QUALITY: 95,
  },

  // Size presets for responsive images
  SIZES: {
    THUMBNAIL: { width: 64, height: 64 },
    AVATAR_SMALL: { width: 32, height: 32 },
    AVATAR_MEDIUM: { width: 48, height: 48 },
    AVATAR_LARGE: { width: 64, height: 64 },
    ICON_SMALL: { width: 16, height: 16 },
    ICON_MEDIUM: { width: 24, height: 24 },
    ICON_LARGE: { width: 32, height: 32 },
    CARD_IMAGE: { width: 300, height: 200 },
  },

  // Supported formats in order of preference
  FORMATS: ['webp', 'jpeg', 'png'],

  // Browser support detection
  WEBP_SUPPORT:
    typeof window !== 'undefined' &&
    window.document?.createElement('canvas').toDataURL('image/webp').indexOf('webp') > -1,
} as const;

// Asset caching strategies
export const CACHE_STRATEGIES = {
  // Cache durations in seconds
  DURATIONS: {
    STATIC_ASSETS: 31536000, // 1 year
    IMAGES: 2592000, // 30 days
    AVATARS: 86400, // 1 day
    DYNAMIC_CONTENT: 3600, // 1 hour
  },

  // Cache keys
  KEYS: {
    COMPRESSED_IMAGES: 'compressed_images',
    AVATAR_CACHE: 'avatar_cache',
    ICON_CACHE: 'icon_cache',
    STATIC_ASSETS: 'static_assets',
  },
} as const;

// Image compression utilities
export class ImageOptimizer {
  private static canvas: HTMLCanvasElement | null = null;
  private static ctx: CanvasRenderingContext2D | null = null;

  private static getCanvas(): HTMLCanvasElement {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
    }
    return this.canvas;
  }

  // Compress image with quality and size options
  static async compressImage(
    file: File | string,
    options: {
      quality?: number;
      maxWidth?: number;
      maxHeight?: number;
      format?: 'jpeg' | 'webp' | 'png';
    } = {}
  ): Promise<string> {
    const {
      quality = IMAGE_OPTIMIZATION.QUALITY.CONTENT,
      maxWidth = 1920,
      maxHeight = 1080,
      format = 'jpeg',
    } = options;

    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = this.getCanvas();
          const ctx = this.ctx!;

          // Calculate optimal dimensions
          const { width, height } = this.calculateOptimalSize(
            img.width,
            img.height,
            maxWidth,
            maxHeight
          );

          canvas.width = width;
          canvas.height = height;

          // Clear canvas and draw resized image
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to optimized format
          const mimeType =
            format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';

          const compressedDataUrl = canvas.toDataURL(mimeType, quality / 100);
          resolve(compressedDataUrl);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = reject;

      if (typeof file === 'string') {
        img.src = file;
      } else {
        const reader = new FileReader();
        reader.onload = e => {
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Calculate optimal size maintaining aspect ratio
  private static calculateOptimalSize(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight;

    let width = originalWidth;
    let height = originalHeight;

    // Scale down if necessary
    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }

    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }

    return {
      width: Math.round(width),
      height: Math.round(height),
    };
  }

  // Generate responsive image srcSet
  static generateSrcSet(
    baseUrl: string,
    sizes: Array<{ width: number; quality?: number }>
  ): string {
    return sizes
      .map(({ width, quality = IMAGE_OPTIMIZATION.QUALITY.CONTENT }) => {
        const url = `${baseUrl}?w=${width}&q=${quality}${
          IMAGE_OPTIMIZATION.WEBP_SUPPORT ? '&f=webp' : ''
        }`;
        return `${url} ${width}w`;
      })
      .join(', ');
  }

  // Create optimized avatar URL
  static getOptimizedAvatarUrl(
    baseUrl: string,
    size: keyof typeof IMAGE_OPTIMIZATION.SIZES = 'AVATAR_MEDIUM'
  ): string {
    const dimensions = IMAGE_OPTIMIZATION.SIZES[size];
    const quality = IMAGE_OPTIMIZATION.QUALITY.AVATAR;

    return `${baseUrl}?w=${dimensions.width}&h=${dimensions.height}&q=${quality}${
      IMAGE_OPTIMIZATION.WEBP_SUPPORT ? '&f=webp' : ''
    }`;
  }

  // Create optimized icon URL
  static getOptimizedIconUrl(
    baseUrl: string,
    size: keyof typeof IMAGE_OPTIMIZATION.SIZES = 'ICON_MEDIUM'
  ): string {
    const dimensions = IMAGE_OPTIMIZATION.SIZES[size];

    return `${baseUrl}?w=${dimensions.width}&h=${dimensions.height}&q=100${
      IMAGE_OPTIMIZATION.WEBP_SUPPORT ? '&f=webp' : ''
    }`;
  }
}

// Asset caching utilities
export class AssetCache {
  private static cache = new Map<string, { data: any; timestamp: number; duration: number }>();

  // Set item in cache with TTL
  static set(
    key: string,
    data: any,
    duration: number = CACHE_STRATEGIES.DURATIONS.DYNAMIC_CONTENT
  ): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      duration: duration * 1000, // Convert to milliseconds
    });

    // Clean up expired items periodically
    if (this.cache.size % 50 === 0) {
      this.cleanup();
    }
  }

  // Get item from cache
  static get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) return null;

    // Check if expired
    if (Date.now() - item.timestamp > item.duration) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  // Remove expired items
  static cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.duration) {
        this.cache.delete(key);
      }
    }
  }

  // Clear all cache
  static clear(): void {
    this.cache.clear();
  }

  // Get cache size and statistics
  static getStats(): { size: number; totalItems: number; hitRate: number } {
    return {
      size: this.cache.size,
      totalItems: this.cache.size,
      hitRate: 0, // Could be implemented with counters
    };
  }
}

// Lazy loading utilities
export class LazyLoader {
  private static observer: IntersectionObserver | null = null;
  private static loadedImages = new Set<string>();

  // Initialize intersection observer
  private static getObserver(): IntersectionObserver {
    if (!this.observer) {
      this.observer = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const img = entry.target as HTMLImageElement;
              this.loadImage(img);
              this.observer?.unobserve(img);
            }
          });
        },
        {
          rootMargin: '50px', // Start loading 50px before entering viewport
          threshold: 0.1,
        }
      );
    }
    return this.observer;
  }

  // Setup lazy loading for an image
  static setupLazyLoading(img: HTMLImageElement, src: string): void {
    if (this.loadedImages.has(src)) {
      img.src = src;
      return;
    }

    img.dataset.src = src;
    img.classList.add('lazy-loading');
    this.getObserver().observe(img);
  }

  // Load image and handle caching
  private static loadImage(img: HTMLImageElement): void {
    const src = img.dataset.src;
    if (!src) return;

    // Check cache first
    const cachedBlob = AssetCache.get<string>(`image_${src}`);
    if (cachedBlob) {
      img.src = cachedBlob;
      img.classList.remove('lazy-loading');
      img.classList.add('lazy-loaded');
      this.loadedImages.add(src);
      return;
    }

    // Load and cache image
    const newImg = new Image();
    newImg.onload = () => {
      img.src = src;
      img.classList.remove('lazy-loading');
      img.classList.add('lazy-loaded');
      this.loadedImages.add(src);

      // Cache for future use
      AssetCache.set(`image_${src}`, src, CACHE_STRATEGIES.DURATIONS.IMAGES);
    };
    newImg.onerror = () => {
      img.classList.remove('lazy-loading');
      img.classList.add('lazy-error');
    };
    newImg.src = src;
  }

  // Preload critical images
  static preloadCriticalImages(urls: string[]): Promise<void[]> {
    return Promise.all(
      urls.map(url => {
        return new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            this.loadedImages.add(url);
            AssetCache.set(`image_${url}`, url, CACHE_STRATEGIES.DURATIONS.IMAGES);
            resolve();
          };
          img.onerror = reject;
          img.src = url;
        });
      })
    );
  }
}

// Progressive loading utilities
export class ProgressiveLoader {
  // Create progressive JPEG-like loading effect
  static createProgressiveImage(
    container: HTMLElement,
    lowQualitySrc: string,
    highQualitySrc: string
  ): void {
    const lowQualityImg = document.createElement('img');
    const highQualityImg = document.createElement('img');

    // Style for smooth transition
    const baseStyle = {
      position: 'absolute' as const,
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      objectFit: 'cover' as const,
    };

    Object.assign(lowQualityImg.style, baseStyle, {
      filter: 'blur(2px)',
      transition: 'opacity 0.3s ease',
    });

    Object.assign(highQualityImg.style, baseStyle, {
      opacity: '0',
      transition: 'opacity 0.3s ease',
    });

    // Load low quality first
    lowQualityImg.src = lowQualitySrc;
    container.appendChild(lowQualityImg);
    container.appendChild(highQualityImg);

    // Load high quality and fade in
    highQualityImg.onload = () => {
      highQualityImg.style.opacity = '1';
      setTimeout(() => {
        lowQualityImg.remove();
      }, 300);
    };
    highQualityImg.src = highQualitySrc;
  }
}

// Asset preloading strategies
export class AssetPreloader {
  private static preloadedAssets = new Set<string>();

  // Preload assets based on priority
  static preloadAssets(assets: Array<{ url: string; priority: 'high' | 'medium' | 'low' }>): void {
    // Sort by priority
    assets.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Preload high priority assets immediately
    const highPriorityAssets = assets.filter(asset => asset.priority === 'high');
    this.preloadImmediately(highPriorityAssets.map(a => a.url));

    // Preload medium priority assets after a short delay
    setTimeout(() => {
      const mediumPriorityAssets = assets.filter(asset => asset.priority === 'medium');
      this.preloadWithIdleCallback(mediumPriorityAssets.map(a => a.url));
    }, 100);

    // Preload low priority assets when browser is idle
    setTimeout(() => {
      const lowPriorityAssets = assets.filter(asset => asset.priority === 'low');
      this.preloadWithIdleCallback(lowPriorityAssets.map(a => a.url));
    }, 1000);
  }

  // Immediate preloading for critical assets
  private static preloadImmediately(urls: string[]): void {
    urls.forEach(url => {
      if (this.preloadedAssets.has(url)) return;

      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = url;

      // Determine asset type
      if (url.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
        link.as = 'image';
      } else if (url.match(/\.(woff|woff2|ttf|otf)$/i)) {
        link.as = 'font';
        link.crossOrigin = 'anonymous';
      } else if (url.match(/\.(css)$/i)) {
        link.as = 'style';
      } else if (url.match(/\.(js)$/i)) {
        link.as = 'script';
      }

      document.head.appendChild(link);
      this.preloadedAssets.add(url);
    });
  }

  // Preload with idle callback for non-critical assets
  private static preloadWithIdleCallback(urls: string[]): void {
    const preloadBatch = () => {
      urls.forEach(url => {
        if (this.preloadedAssets.has(url)) return;

        const img = new Image();
        img.src = url;
        this.preloadedAssets.add(url);
      });
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(preloadBatch, { timeout: 2000 });
    } else {
      setTimeout(preloadBatch, 100);
    }
  }
}

// CSS for optimized image loading
export const imageOptimizationStyles = `
/* Lazy loading states */
.lazy-loading {
  background: linear-gradient(90deg, #f0f0f0 25%, transparent 37%, #f0f0f0 63%);
  background-size: 400% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

.lazy-loaded {
  animation: fadeIn 0.3s ease-in-out;
}

.lazy-error {
  background-color: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lazy-error::after {
  content: '⚠️';
  font-size: 24px;
  opacity: 0.5;
}

/* Shimmer animation for loading */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Fade in animation */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Progressive image container */
.progressive-image {
  position: relative;
  overflow: hidden;
  background-color: #f5f5f5;
}

/* Responsive image utilities */
.responsive-image {
  width: 100%;
  height: auto;
  max-width: 100%;
}

/* Avatar optimization */
.optimized-avatar {
  border-radius: 50%;
  object-fit: cover;
  background-color: #e5e7eb;
}

/* Icon optimization */
.optimized-icon {
  display: inline-block;
  vertical-align: middle;
}

/* Preload critical images */
.critical-image {
  object-fit: cover;
  background-color: #f5f5f5;
}
`;

// Utility functions
export const AssetUtils = {
  // Get file size from data URL
  getDataUrlSize: (dataUrl: string): number => {
    const base64String = dataUrl.split(',')[1];
    return Math.round((base64String.length * 3) / 4);
  },

  // Convert file size to human readable format
  formatFileSize: (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  // Generate low quality placeholder
  generatePlaceholder: (width: number, height: number, color: string = '#e5e7eb'): string => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);

    return canvas.toDataURL('image/png');
  },

  // Check if image is already cached
  isImageCached: (url: string): boolean => {
    return AssetCache.get(`image_${url}`) !== null;
  },

  // Prefetch critical resources
  prefetchResources: (urls: string[]): void => {
    urls.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      document.head.appendChild(link);
    });
  },
};
