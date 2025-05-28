"use client";

import { useEffect, useState } from 'react';
import { CreditCard, Loader2, RefreshCw, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Header } from '@/components/header';

interface CreditBalance {
  video_credits?: number;
  genai_credits?: number;
  partial_errors?: string[];
}

export default function SettingsPage() {
  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCredits = async (showRefreshToast = false) => {
    try {
      setError(null);
      if (showRefreshToast) setRefreshing(true);
      
      const response = await fetch('/api/picsart/credits');
      
      if (!response.ok) {
        throw new Error('Failed to fetch credit balance');
      }
      
      const data = await response.json();
      setCredits(data);
      
      if (showRefreshToast) {
        toast({ 
          title: 'Credits Updated', 
          description: 'Your credit balance has been refreshed.' 
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch credits';
      setError(errorMessage);
      toast({ 
        title: 'Error', 
        description: errorMessage, 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCredits();
  }, []);

  const handleRefresh = () => {
    fetchCredits(true);
  };

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and view your API usage.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Credit Balance Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                API Credits Balance
              </CardTitle>
              <CardDescription>
                Your current Picsart API credit balance for Video and GenAI processing
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={loading || refreshing}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading credit balance...</span>
              </div>
            ) : error ? (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Unable to fetch credit balance: Your API key doesn't have Video API permissions.
                  </AlertDescription>
                </Alert>
                
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">How to fix this:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Contact Picsart support to enable Video API access for your account</li>
                    <li>Or upgrade to a plan that includes Video API permissions</li>
                    <li>Check your <a href="https://console.picsart.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Picsart Console</a> for available API features</li>
                  </ol>
                </div>
                
                {/* Fallback display */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 rounded-lg border border-dashed">
                  <div className="text-2xl font-bold text-gray-400 dark:text-gray-600">
                    N/A
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Video Credits (Unavailable)
                  </div>
                </div>
              </div>
            ) : credits ? (
              <div className="space-y-4">
                {/* Credits Display */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
                  {/* Video Credits */}
                  <div className={`p-4 rounded-lg border ${
                    credits.video_credits !== undefined 
                      ? 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900' 
                      : 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border-dashed'
                  }`}>
                    <div className={`text-2xl font-bold ${
                      credits.video_credits !== undefined 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-gray-400 dark:text-gray-600'
                    }`}>
                      {credits.video_credits !== undefined ? credits.video_credits.toLocaleString() : 'N/A'}
                    </div>
                    <div className={`text-sm ${
                      credits.video_credits !== undefined 
                        ? 'text-blue-600/80 dark:text-blue-400/80' 
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      Video Credits {credits.video_credits === undefined ? '(Unavailable)' : ''}
                    </div>
                  </div>
                  
                  {/* GenAI Credits */}
                  <div className={`p-4 rounded-lg border ${
                    credits.genai_credits !== undefined 
                      ? 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900' 
                      : 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border-dashed'
                  }`}>
                    <div className={`text-2xl font-bold ${
                      credits.genai_credits !== undefined 
                        ? 'text-purple-600 dark:text-purple-400' 
                        : 'text-gray-400 dark:text-gray-600'
                    }`}>
                      {credits.genai_credits !== undefined ? credits.genai_credits.toLocaleString() : 'N/A'}
                    </div>
                    <div className={`text-sm ${
                      credits.genai_credits !== undefined 
                        ? 'text-purple-600/80 dark:text-purple-400/80' 
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      GenAI Credits {credits.genai_credits === undefined ? '(Unavailable)' : ''}
                    </div>
                  </div>
                </div>

                {/* Partial Errors Warning */}
                {credits.partial_errors && credits.partial_errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Some API endpoints failed: {credits.partial_errors.join(', ')}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>
              Your account details and preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Additional account settings will be available here in future updates.
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </>
  );
}
