// CSS optimization utilities for improved performance and reduced layout shifts

// Critical CSS constants
export const CSS_OPTIMIZATION = {
  // Performance thresholds
  THRESHOLDS: {
    CRITICAL_CSS_SIZE: 14000, // 14KB critical CSS limit
    INLINE_CSS_LIMIT: 4000, // 4KB inline CSS limit
    UNUSED_CSS_THRESHOLD: 80, // Remove CSS with <80% usage
  },

  // Layout shift prevention
  LAYOUT_PREVENTION: {
    // Common aspect ratios for media
    ASPECT_RATIOS: {
      SQUARE: '1:1',
      LANDSCAPE: '16:9',
      PORTRAIT: '9:16',
      CARD: '4:3',
      WIDE: '21:9',
    },

    // Standard sizes for common elements
    PLACEHOLDER_SIZES: {
      AVATAR: { width: 40, height: 40 },
      BUTTON: { width: 120, height: 36 },
      INPUT: { width: 200, height: 40 },
      CARD: { width: 300, height: 200 },
      THUMBNAIL: { width: 64, height: 64 },
    },
  },

  // CSS optimization strategies
  STRATEGIES: {
    CRITICAL_ABOVE_FOLD: ['layout', 'typography', 'colors', 'spacing'],
    DEFER_BELOW_FOLD: ['animations', 'hover-effects', 'non-critical-components'],
    INLINE_CRITICAL: ['reset', 'grid', 'typography', 'critical-components'],
  },
} as const;

// CSS performance monitoring
export class CSSPerformanceMonitor {
  private static metrics = {
    layoutShifts: 0,
    renderBlockingCSS: 0,
    unusedCSS: 0,
    criticalCSSSize: 0,
  };

  // Monitor Cumulative Layout Shift (CLS)
  static monitorLayoutShifts(): () => void {
    if (!('PerformanceObserver' in window)) {
      return () => {};
    }

    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
          this.metrics.layoutShifts += (entry as any).value;
        }
      }
    });

    observer.observe({ type: 'layout-shift', buffered: true });

    return () => observer.disconnect();
  }

  // Monitor render-blocking resources
  static monitorRenderBlocking(): void {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.name.endsWith('.css') && (entry as any).renderBlockingStatus === 'blocking') {
            this.metrics.renderBlockingCSS++;
          }
        }
      });

      observer.observe({ type: 'resource', buffered: true });
    }
  }

  // Get current metrics
  static getMetrics() {
    return { ...this.metrics };
  }

  // Reset metrics
  static reset(): void {
    this.metrics = {
      layoutShifts: 0,
      renderBlockingCSS: 0,
      unusedCSS: 0,
      criticalCSSSize: 0,
    };
  }
}

// Layout shift prevention utilities
export class LayoutStabilizer {
  // Create placeholder with known dimensions
  static createPlaceholder(
    element: HTMLElement,
    dimensions: { width?: number; height?: number; aspectRatio?: string }
  ): void {
    const { width, height, aspectRatio } = dimensions;

    if (aspectRatio) {
      element.style.aspectRatio = aspectRatio;
    }

    if (width) {
      element.style.width = `${width}px`;
    }

    if (height) {
      element.style.height = `${height}px`;
    }

    // Prevent layout shifts during loading
    element.style.minHeight = height ? `${height}px` : '1px';
    element.style.containIntrinsicSize = width && height ? `${width}px ${height}px` : 'auto';
  }

  // Reserve space for dynamic content
  static reserveSpace(
    container: HTMLElement,
    estimatedHeight: number,
    adjustOnLoad: boolean = true
  ): () => void {
    const originalHeight = container.style.height;
    container.style.minHeight = `${estimatedHeight}px`;

    if (adjustOnLoad) {
      const observer = new ResizeObserver(() => {
        if (container.scrollHeight > estimatedHeight) {
          container.style.minHeight = 'auto';
          observer.disconnect();
        }
      });
      observer.observe(container);

      return () => observer.disconnect();
    }

    return () => {
      container.style.height = originalHeight;
      container.style.minHeight = 'auto';
    };
  }

  // Preload fonts to prevent text layout shifts
  static preloadFonts(fontFaces: Array<{ family: string; weight?: string; style?: string }>): void {
    fontFaces.forEach(({ family, weight = '400', style = 'normal' }) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'font';
      link.type = 'font/woff2';
      link.crossOrigin = 'anonymous';
      link.href = `/fonts/${family}-${weight}-${style}.woff2`;
      document.head.appendChild(link);
    });
  }

  // Apply size-based CSS containment
  static applyContainment(element: HTMLElement, type: 'size' | 'layout' | 'style' | 'paint'): void {
    element.style.contain = type;
  }
}

// Critical CSS management
export class CriticalCSSManager {
  private static criticalCSS = new Set<string>();
  private static deferredCSS = new Set<string>();

  // Identify critical CSS selectors
  static identifyCriticalCSS(): string[] {
    const criticalSelectors: string[] = [];

    // Get above-the-fold elements
    const viewportHeight = window.innerHeight;
    const aboveFoldElements = Array.from(document.querySelectorAll('*')).filter(
      el => el.getBoundingClientRect().top < viewportHeight
    );

    // Extract CSS rules for above-the-fold elements
    aboveFoldElements.forEach(element => {
      const computedStyle = window.getComputedStyle(element);
      const tagName = element.tagName.toLowerCase();
      const className = element.className;
      const id = element.id;

      // Add tag selectors
      criticalSelectors.push(tagName);

      // Add class selectors
      if (className) {
        className.split(' ').forEach(cls => {
          criticalSelectors.push(`.${cls}`);
        });
      }

      // Add ID selectors
      if (id) {
        criticalSelectors.push(`#${id}`);
      }
    });

    return Array.from(new Set(criticalSelectors));
  }

  // Extract critical CSS
  static async extractCriticalCSS(html: string, css: string): Promise<string> {
    // This is a simplified version - in production, use tools like critical or penthouse
    const criticalSelectors = this.identifyCriticalCSS();
    const criticalRules: string[] = [];

    // Parse CSS and extract matching rules
    const cssRules = css.split('}').map(rule => rule.trim() + '}');

    cssRules.forEach(rule => {
      for (const selector of criticalSelectors) {
        if (rule.includes(selector)) {
          criticalRules.push(rule);
        }
      }
    });

    return criticalRules.join('\n');
  }

  // Inline critical CSS
  static inlineCriticalCSS(css: string): void {
    const style = document.createElement('style');
    style.textContent = css;
    style.setAttribute('data-critical', 'true');
    document.head.insertBefore(style, document.head.firstChild);
  }

  // Load non-critical CSS asynchronously
  static loadNonCriticalCSS(href: string, media: string = 'all'): void {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = href;
    link.media = 'print'; // Load as print to avoid blocking
    link.onload = () => {
      link.media = media; // Switch to target media once loaded
    };
    document.head.appendChild(link);
  }
}

// CSS optimization utilities
export class CSSOptimizer {
  // Remove unused CSS selectors
  static removeUnusedCSS(css: string): string {
    const usedSelectors = new Set<string>();

    // Get all elements and their classes/IDs
    document.querySelectorAll('*').forEach(element => {
      usedSelectors.add(element.tagName.toLowerCase());

      if (element.className) {
        element.className.split(' ').forEach(cls => {
          usedSelectors.add(`.${cls}`);
        });
      }

      if (element.id) {
        usedSelectors.add(`#${element.id}`);
      }
    });

    // Filter CSS rules
    const cssRules = css.split('}');
    const optimizedRules = cssRules.filter(rule => {
      const selectorPart = rule.split('{')[0];
      if (!selectorPart) return false;
      const selector = selectorPart.trim();
      if (!selector) return false;

      // Check if selector is used
      return Array.from(usedSelectors).some(used => selector.includes(used));
    });

    return optimizedRules.join('}');
  }

  // Minify CSS
  static minifyCSS(css: string): string {
    return (
      css
        // Remove comments
        .replace(/\/\*[\s\S]*?\*\//g, '')
        // Remove unnecessary whitespace
        .replace(/\s+/g, ' ')
        // Remove whitespace around selectors and properties
        .replace(/\s*{\s*/g, '{')
        .replace(/;\s*/g, ';')
        .replace(/}\s*/g, '}')
        // Remove trailing semicolons
        .replace(/;}/g, '}')
        .trim()
    );
  }

  // Bundle CSS efficiently
  static bundleCSS(cssFiles: string[]): Promise<string> {
    return Promise.all(
      cssFiles.map(async file => {
        const response = await fetch(file);
        return response.text();
      })
    ).then(styles => {
      const bundled = styles.join('\n');
      return this.minifyCSS(bundled);
    });
  }
}

// Dynamic CSS loading utilities
export class DynamicCSSLoader {
  private static loadedStylesheets = new Set<string>();
  private static loadingPromises = new Map<string, Promise<void>>();

  // Load CSS on demand
  static async loadCSS(
    href: string,
    options: {
      media?: string;
      priority?: 'high' | 'low';
      critical?: boolean;
    } = {}
  ): Promise<void> {
    const { media = 'all', priority = 'low', critical = false } = options;

    if (this.loadedStylesheets.has(href)) {
      return Promise.resolve();
    }

    if (this.loadingPromises.has(href)) {
      return this.loadingPromises.get(href)!;
    }

    const promise = new Promise<void>((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = critical ? 'stylesheet' : 'preload';
      link.as = critical ? undefined : 'style';
      link.href = href;
      link.media = media;

      if (priority === 'high') {
        link.setAttribute('importance', 'high');
      }

      link.onload = () => {
        if (!critical) {
          link.rel = 'stylesheet';
        }
        this.loadedStylesheets.add(href);
        this.loadingPromises.delete(href);
        resolve();
      };

      link.onerror = () => {
        this.loadingPromises.delete(href);
        reject(new Error(`Failed to load CSS: ${href}`));
      };

      document.head.appendChild(link);
    });

    this.loadingPromises.set(href, promise);
    return promise;
  }

  // Load CSS based on component visibility
  static loadCSSOnIntersection(
    element: HTMLElement,
    cssHref: string,
    options: { rootMargin?: string; threshold?: number } = {}
  ): () => void {
    const { rootMargin = '100px', threshold = 0.1 } = options;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadCSS(cssHref);
            observer.unobserve(element);
          }
        });
      },
      { rootMargin, threshold }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }

  // Load CSS based on user interaction
  static loadCSSOnInteraction(
    element: HTMLElement,
    cssHref: string,
    events: string[] = ['mouseenter', 'touchstart']
  ): () => void {
    const loadCSS = () => {
      this.loadCSS(cssHref);
      cleanup();
    };

    const cleanup = () => {
      events.forEach(event => {
        element.removeEventListener(event, loadCSS);
      });
    };

    events.forEach(event => {
      element.addEventListener(event, loadCSS, { once: true, passive: true });
    });

    return cleanup;
  }
}

// CSS performance optimization styles
export const cssPerformanceStyles = `
/* Layout shift prevention */
.prevent-layout-shift {
  contain: layout style;
}

/* Efficient animations */
.gpu-accelerated {
  transform: translateZ(0);
  will-change: transform;
}

.efficient-transition {
  transition: transform 0.2s ease-out, opacity 0.2s ease-out;
}

/* Critical loading states */
.critical-loading {
  background: linear-gradient(90deg, #f0f0f0 25%, transparent 37%, #f0f0f0 63%);
  background-size: 400% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

/* Font loading optimization */
.font-loading {
  font-display: swap;
}

/* Container queries for responsive design */
.container-responsive {
  container-type: inline-size;
}

@container (min-width: 300px) {
  .container-responsive .content {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}

/* CSS containment for performance */
.layout-contained {
  contain: layout;
}

.paint-contained {
  contain: paint;
}

.size-contained {
  contain: size;
}

.style-contained {
  contain: style;
}

/* Optimized scrolling */
.smooth-scroll {
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
}

/* Prevent repaints during animations */
.animation-optimized {
  backface-visibility: hidden;
  perspective: 1000px;
}

/* Critical path optimizations */
.above-fold {
  priority: 1;
}

.below-fold {
  priority: 0;
}

/* Resource hints via CSS */
.preload-critical::before {
  content: '';
  display: block;
  width: 0;
  height: 0;
  background-image: url('/critical-image.webp');
}
`;

// Utility functions for CSS optimization
export const CSSUtils = {
  // Calculate CSS specificity
  calculateSpecificity: (selector: string): number => {
    const idCount = (selector.match(/#/g) || []).length;
    const classCount = (selector.match(/\./g) || []).length;
    const elementCount = (selector.match(/[a-zA-Z]/g) || []).length;

    return idCount * 100 + classCount * 10 + elementCount;
  },

  // Check if CSS property is supported
  isPropertySupported: (property: string, value: string): boolean => {
    const element = document.createElement('div');
    element.style.setProperty(property, value);
    return element.style.getPropertyValue(property) === value;
  },

  // Get critical viewport CSS
  getCriticalViewportCSS: (): { width: number; height: number; ratio: number } => {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      ratio: window.innerWidth / window.innerHeight,
    };
  },

  // Optimize CSS custom properties
  optimizeCustomProperties: (css: string): string => {
    // Group related custom properties
    const optimized = css.replace(/:root\s*{([^}]*)}/g, (match, properties) => {
      const sorted = properties
        .split(';')
        .filter((prop: string) => prop.trim())
        .sort()
        .join(';');
      return `:root{${sorted}}`;
    });

    return optimized;
  },

  // Generate responsive CSS
  generateResponsiveCSS: (
    selector: string,
    properties: Record<string, string>,
    breakpoints: Record<string, string>
  ): string => {
    let css = `${selector} { ${Object.entries(properties)
      .map(([prop, value]) => `${prop}: ${value}`)
      .join('; ')} }`;

    Object.entries(breakpoints).forEach(([breakpoint, mediaQuery]) => {
      css += `\n@media ${mediaQuery} { ${selector} { /* responsive styles */ } }`;
    });

    return css;
  },

  // Check for CSS performance issues
  checkPerformanceIssues: (css: string): string[] => {
    const issues: string[] = [];

    // Check for expensive selectors
    if (css.includes('*')) {
      issues.push('Universal selector (*) detected - may impact performance');
    }

    // Check for inefficient descendant selectors
    const deepSelectors = css.match(/(\w+\s+){4,}/g);
    if (deepSelectors) {
      issues.push('Deep descendant selectors detected - consider using more specific classes');
    }

    // Check for !important overuse
    const importantCount = (css.match(/!important/g) || []).length;
    if (importantCount > 10) {
      issues.push('Excessive use of !important detected');
    }

    return issues;
  },
};
