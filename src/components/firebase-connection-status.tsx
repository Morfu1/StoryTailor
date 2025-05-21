"use client";

import { useEffect, useState } from 'react';
import { AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { FirebaseTroubleshooter } from './firebase-troubleshooter';

export function FirebaseConnectionStatus() {
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showTroubleshooter, setShowTroubleshooter] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    
    const checkConnection = async () => {
      try {
        // Try to make a simple query to Firestore
        const testQuery = query(collection(db, 'stories'), limit(1));
        await getDocs(testQuery);
        
        if (isMounted) {
          setConnectionStatus('connected');
          setErrorMessage(null);
          setShowTroubleshooter(false);
          retryCount = 0;
        }
      } catch (error: any) {
        // Check for permission errors first - these are expected when not logged in
        if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
          // This is normal when not logged in - don't show an error
          console.log('Firebase permissions error - this is expected when not logged in');
          if (isMounted) {
            setConnectionStatus('connected'); // Don't show error for permission issues
            setErrorMessage(null);
            setShowTroubleshooter(false);
            retryCount = 0;
          }
          return; // Exit early, don't count as a retry
        }
        
        // For other errors, log as error
        console.error('Firebase connection test failed:', error);
        
        if (isMounted) {
          retryCount++;
          
          if (retryCount >= maxRetries) {
            setConnectionStatus('error');
            setShowTroubleshooter(true);
            
            // Determine the type of error
            if (
              error.code === 'unavailable' ||
              error.message?.includes('network') ||
              error.message?.includes('ERR_BLOCKED_BY_CLIENT') ||
              error.message?.includes('ERR_HTTP2_PROTOCOL_ERROR') ||
              error.message?.includes('failed to fetch')
            ) {
              // Likely an ad blocker or network issue
              setErrorMessage('Connection to Firebase blocked. Please disable any ad blockers or privacy extensions for this site.');
              toast({
                title: 'Connection Blocked',
                description: 'Firebase connection appears to be blocked. Please disable ad blockers for this site.',
                variant: 'destructive'
              });
            } else {
              // Other Firebase errors
              setErrorMessage(`Firebase connection error: ${error.message || 'Unknown error'}`);
            }
          } else {
            // Still in retry phase, don't show error yet
            console.log(`Firebase connection retry ${retryCount}/${maxRetries}...`);
          }
        }
      }
    };

    // Check connection immediately and then every 30 seconds
    checkConnection();
    const interval = setInterval(checkConnection, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [toast]);

  if (connectionStatus === 'checking' || connectionStatus === 'connected') {
    return null;
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-2">
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        <div className="flex items-center">
          <WifiOff className="h-5 w-5 mr-2 flex-shrink-0" />
          <div>
            <p className="font-bold">Firebase Connection Issue</p>
            <p>{errorMessage || 'Unable to connect to Firebase'}</p>
            <p className="text-sm mt-1">
              If you're using an ad blocker or privacy extension, please disable it for this site.
            </p>
          </div>
        </div>
      </div>
      
      {showTroubleshooter && <FirebaseTroubleshooter />}
    </div>
  );
}