
"use client";

import { useEffect, useState, useRef } from 'react';
import { WifiOff } from 'lucide-react'; // Removed AlertCircle
import { db } from '@/lib/firebase';
import { collection, getDocs, limit, query, onSnapshot, Unsubscribe } from 'firebase/firestore'; // Added onSnapshot and Unsubscribe
import { useToast } from '@/hooks/use-toast';
import { FirebaseTroubleshooter } from './firebase-troubleshooter';

export function FirebaseConnectionStatus() {
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showTroubleshooter, setShowTroubleshooter] = useState(false);
  const { toast } = useToast();
  const rpcErrorCount = useRef(0);
  const rpcErrorTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    let unsubscribeTestListener: Unsubscribe | null = null;

    // Monitor console for specific RPC Listen errors
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      if (isMounted && typeof args[0] === 'string' && args[0].includes("WebChannelConnection RPC 'Listen' stream") && args[0].includes("transport errored")) {
        rpcErrorCount.current++;
        // If multiple RPC errors occur quickly, flag it as a potential persistent issue
        if (rpcErrorTimer.current) clearTimeout(rpcErrorTimer.current);
        rpcErrorTimer.current = setTimeout(() => {
          if (isMounted && rpcErrorCount.current >= 3) { // Threshold for concern
            if (connectionStatus !== 'error') { // Only show if not already in general error state
                setConnectionStatus('error');
                setErrorMessage('Persistent Firebase real-time connection errors detected. This might be due to ad blockers, privacy extensions, or network issues.');
                setShowTroubleshooter(true);
                toast({
                    title: 'Firebase Real-time Issue',
                    description: 'Having trouble with live data updates. Check for ad blockers or network problems.',
                    variant: 'destructive',
                    duration: 10000
                });
            }
          }
          rpcErrorCount.current = 0; // Reset count after timeout
        }, 5000); // Check over a 5-second window
      }
      originalConsoleError.apply(console, args);
    };

    const checkConnection = async () => {
      if (!isMounted) return;
      try {
        // Test basic read
        const testQuery = query(collection(db, 'stories'), limit(1));
        await getDocs(testQuery);

        // Test real-time listener briefly
        // Note: This will attempt to establish a listener.
        // If this itself is blocked, it might throw an error caught below.
        // If it succeeds but later RPC errors occur, the console.error override will catch them.
        if (unsubscribeTestListener) unsubscribeTestListener(); // Clean up previous listener
        unsubscribeTestListener = onSnapshot(testQuery,
          () => { // Success callback, snapshot unused
            if (isMounted && connectionStatus !== 'error') { // Don't override if already in RPC error state
              setConnectionStatus('connected');
              setErrorMessage(null);
              setShowTroubleshooter(false); // Hide troubleshooter if connection recovers
            }
            if (unsubscribeTestListener) unsubscribeTestListener(); // Unsubscribe immediately after success
            retryCount = 0; // Reset retries on success
          },
          (error) => { // Error callback for onSnapshot
            if (!isMounted) return;
            console.warn('Firebase onSnapshot test listener error:', error);
            // This error is for the listener setup itself, not necessarily a transport error
            // but could indicate a problem. Let the main catch block handle general errors.
            // We won't immediately set to 'error' state from here unless it's a persistent failure in the main try-catch.
          }
        );
        
      } catch (error: unknown) {
        if (!isMounted) return;
        const firebaseError = error as { code?: string; message?: string };
        // Handle permission errors silently for this check as they are expected if not logged in
        if (firebaseError.code === 'permission-denied' || firebaseError.message?.includes('Missing or insufficient permissions')) {
          if (connectionStatus !== 'error') { // Don't override if already in RPC error state
            setConnectionStatus('connected');
            setErrorMessage(null);
            setShowTroubleshooter(false);
          }
          retryCount = 0;
          return;
        }
        
        console.error('Firebase connection test failed:', error);
        retryCount++;
        
        if (retryCount >= maxRetries) {
          setConnectionStatus('error');
          setShowTroubleshooter(true);
          if (firebaseError.code === 'unavailable' || firebaseError.message?.includes('network') || firebaseError.message?.includes('ERR_BLOCKED_BY_CLIENT') || firebaseError.message?.includes('ERR_HTTP2_PROTOCOL_ERROR') || firebaseError.message?.includes('failed to fetch')) {
            setErrorMessage('Connection to Firebase blocked. Please disable any ad blockers or privacy extensions for this site.');
            toast({
              title: 'Connection Blocked',
              description: 'Firebase connection appears to be blocked. Please disable ad blockers for this site.',
              variant: 'destructive',
              duration: 10000
            });
          } else {
            setErrorMessage(`Firebase connection error: ${firebaseError.message || 'Unknown error'}`);
          }
        } else {
          console.log(`Firebase connection retry ${retryCount}/${maxRetries}...`);
        }
      }
    };

    checkConnection(); // Initial check
    const interval = setInterval(checkConnection, 30000); // Periodic check

    return () => {
      isMounted = false;
      clearInterval(interval);
      console.error = originalConsoleError; // Restore original console.error
      if (rpcErrorTimer.current) clearTimeout(rpcErrorTimer.current);
      if (unsubscribeTestListener) unsubscribeTestListener(); // Cleanup listener
    };
  }, [toast, connectionStatus]); // Added connectionStatus to deps to avoid stale closure issues

  if (connectionStatus === 'checking' || connectionStatus === 'connected') {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:fixed sm:bottom-4 sm:right-4 sm:left-auto sm:max-w-md" role="alert">
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md shadow-lg">
        <div className="flex items-center">
          <WifiOff className="h-5 w-5 mr-3 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold">Firebase Connection Issue</p>
            <p className="text-sm">{errorMessage || 'Unable to connect to Firebase or maintain a stable connection.'}</p>
            {!showTroubleshooter && errorMessage && (
              <button 
                onClick={() => setShowTroubleshooter(true)} 
                className="text-xs underline mt-1 hover:text-red-900"
              >
                Show troubleshooting steps
              </button>
            )}
          </div>
        </div>
        {showTroubleshooter && (
          <div className="mt-3 pt-3 border-t border-red-300">
            <FirebaseTroubleshooter />
          </div>
        )}
      </div>
    </div>
  );
}

