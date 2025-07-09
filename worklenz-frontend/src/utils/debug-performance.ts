// Debug utility for identifying performance bottlenecks with 400 tasks

export const debugPerformance = {
  // Log component render times
  logComponentRender: (componentName: string, startTime: number) => {
    const renderTime = performance.now() - startTime;
    if (renderTime > 16) {
      // Log slow renders (>16ms)
      console.warn(`Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms`);
    }
  },

  // Log Redux selector performance
  logSelectorPerformance: (selectorName: string, startTime: number) => {
    const executionTime = performance.now() - startTime;
    if (executionTime > 5) {
      // Log slow selectors (>5ms)
      console.warn(`Slow selector detected: ${selectorName} took ${executionTime.toFixed(2)}ms`);
    }
  },

  // Log memory usage
  logMemoryUsage: () => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usedMB = memory.usedJSHeapSize / 1024 / 1024;
      const totalMB = memory.totalJSHeapSize / 1024 / 1024;
      const limitMB = memory.jsHeapSizeLimit / 1024 / 1024;

      console.log(
        `Memory Usage: ${usedMB.toFixed(1)}MB / ${totalMB.toFixed(1)}MB (${limitMB.toFixed(1)}MB limit)`
      );

      if (usedMB > 100) {
        console.warn(`High memory usage detected: ${usedMB.toFixed(1)}MB`);
      }
    }
  },

  // Log DOM node count
  logDOMNodes: () => {
    const nodeCount = document.querySelectorAll('*').length;
    console.log(`Total DOM nodes: ${nodeCount}`);

    if (nodeCount > 1000) {
      console.warn(`High DOM node count detected: ${nodeCount} nodes`);
    }
  },

  // Log React component count
  logReactComponents: () => {
    // This is a rough estimate - React DevTools would be more accurate
    const reactComponents = document.querySelectorAll('[data-reactroot], [data-reactid]').length;
    console.log(`React components (estimate): ${reactComponents}`);
  },

  // Log scroll performance
  logScrollPerformance: () => {
    let lastScrollTime = 0;
    let scrollCount = 0;

    const handleScroll = () => {
      const currentTime = performance.now();
      const timeSinceLastScroll = currentTime - lastScrollTime;

      if (timeSinceLastScroll < 16) {
        // Less than 60fps
        scrollCount++;
        if (scrollCount > 5) {
          console.warn(
            `Poor scroll performance detected: ${timeSinceLastScroll.toFixed(2)}ms between scrolls`
          );
        }
      } else {
        scrollCount = 0;
      }

      lastScrollTime = currentTime;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  },

  // Log long tasks
  logLongTasks: () => {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'longtask') {
            console.warn(`Long task detected: ${entry.duration.toFixed(2)}ms`, entry);
          }
        }
      });

      observer.observe({ entryTypes: ['longtask'] });

      return () => {
        observer.disconnect();
      };
    }

    return () => {};
  },

  // NEW: Monitor hover performance specifically
  logHoverPerformance: () => {
    let hoverStartTime = 0;
    let hoverCount = 0;
    let totalHoverTime = 0;

    const handleMouseEnter = () => {
      hoverStartTime = performance.now();
    };

    const handleMouseLeave = () => {
      if (hoverStartTime > 0) {
        const hoverDuration = performance.now() - hoverStartTime;
        totalHoverTime += hoverDuration;
        hoverCount++;

        if (hoverDuration > 50) {
          // Log slow hover operations (>50ms)
          console.warn(`Slow hover operation detected: ${hoverDuration.toFixed(2)}ms`);
        }

        // Log average hover time every 10 hovers
        if (hoverCount % 10 === 0) {
          const avgHoverTime = totalHoverTime / hoverCount;
          console.log(`Average hover time: ${avgHoverTime.toFixed(2)}ms (${hoverCount} hovers)`);
        }

        hoverStartTime = 0;
      }
    };

    // Monitor hover events on task rows specifically
    const taskRows = document.querySelectorAll('.task-row-optimized, .task-row');
    taskRows.forEach(row => {
      row.addEventListener('mouseenter', handleMouseEnter, { passive: true });
      row.addEventListener('mouseleave', handleMouseLeave, { passive: true });
    });

    return () => {
      taskRows.forEach(row => {
        row.removeEventListener('mouseenter', handleMouseEnter);
        row.removeEventListener('mouseleave', handleMouseLeave);
      });
    };
  },

  // NEW: Monitor CSS transitions and animations
  logCSSPerformance: () => {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure') {
            const duration = entry.duration;
            if (duration > 16) {
              // Log slow CSS operations (>16ms)
              console.warn(`Slow CSS operation detected: ${duration.toFixed(2)}ms - ${entry.name}`);
            }
          }
        }
      });

      observer.observe({ entryTypes: ['measure'] });

      return () => {
        observer.disconnect();
      };
    }

    return () => {};
  },

  // Comprehensive performance check
  runPerformanceCheck: () => {
    console.group('🔍 Performance Check');

    // Memory usage
    debugPerformance.logMemoryUsage();

    // DOM nodes
    debugPerformance.logDOMNodes();

    // React components
    debugPerformance.logReactComponents();

    // Start monitoring
    const stopScroll = debugPerformance.logScrollPerformance();
    const stopLongTasks = debugPerformance.logLongTasks();
    const stopHover = debugPerformance.logHoverPerformance();
    const stopCSS = debugPerformance.logCSSPerformance();

    console.groupEnd();

    return () => {
      stopScroll();
      stopLongTasks();
      stopHover();
      stopCSS();
    };
  },

  // Monitor specific component
  monitorComponent: (componentName: string) => {
    const startTime = performance.now();

    return () => {
      debugPerformance.logComponentRender(componentName, startTime);
    };
  },

  // Monitor Redux selector
  monitorSelector: (selectorName: string, selectorFn: () => any) => {
    const startTime = performance.now();
    const result = selectorFn();
    debugPerformance.logSelectorPerformance(selectorName, startTime);
    return result;
  },

  // NEW: Quick hover performance test
  testHoverPerformance: () => {
    console.group('🧪 Hover Performance Test');

    const taskRows = document.querySelectorAll('.task-row-optimized, .task-row');
    console.log(`Found ${taskRows.length} task rows to test`);

    let totalHoverTime = 0;
    let hoverCount = 0;

    const testHover = (row: Element) => {
      return new Promise<void>(resolve => {
        const startTime = performance.now();

        // Simulate hover
        row.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

        setTimeout(() => {
          row.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
          const hoverTime = performance.now() - startTime;
          totalHoverTime += hoverTime;
          hoverCount++;

          if (hoverTime > 50) {
            console.warn(`Slow hover on row ${hoverCount}: ${hoverTime.toFixed(2)}ms`);
          }

          resolve();
        }, 100);
      });
    };

    // Test first 5 rows
    const testRows = Array.from(taskRows).slice(0, 5);
    Promise.all(testRows.map(testHover)).then(() => {
      const avgHoverTime = totalHoverTime / hoverCount;
      console.log(`Average hover time: ${avgHoverTime.toFixed(2)}ms (${hoverCount} tests)`);

      if (avgHoverTime > 30) {
        console.error(`🚨 Poor hover performance detected: ${avgHoverTime.toFixed(2)}ms average`);
      } else if (avgHoverTime > 16) {
        console.warn(`⚠️ Suboptimal hover performance: ${avgHoverTime.toFixed(2)}ms average`);
      } else {
        console.log(`✅ Good hover performance: ${avgHoverTime.toFixed(2)}ms average`);
      }

      console.groupEnd();
    });
  },
};

// Auto-run performance check in development
if (process.env.NODE_ENV === 'development') {
  // Run initial check after page load
  window.addEventListener('load', () => {
    setTimeout(() => {
      debugPerformance.runPerformanceCheck();

      // Run hover performance test after 3 seconds
      setTimeout(() => {
        debugPerformance.testHoverPerformance();
      }, 3000);
    }, 2000); // Wait for initial render
  });
}

// Export for manual use
export default debugPerformance;
