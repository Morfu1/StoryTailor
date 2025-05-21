/**
 * This utility suppresses the React DevTools warning in development mode.
 * It's used in the app layout to prevent the warning from appearing in the console.
 */

export function suppressReactDevToolsWarning() {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    // Store the original console.log
    const originalConsoleLog = console.log;
    
    // Override console.log to filter out the React DevTools warning
    console.log = function(...args) {
      // Check if this is the React DevTools warning
      if (
        typeof args[0] === 'string' && 
        args[0].includes('Download the React DevTools')
      ) {
        // Suppress this specific message
        return;
      }
      
      // Pass through all other console.log calls
      return originalConsoleLog.apply(console, args);
    };
  }
}