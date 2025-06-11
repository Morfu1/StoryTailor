
"use client";

import { useEffect, useState, useCallback } from 'react';
import { CreditCard, Loader2, RefreshCw, AlertCircle, KeyRound, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Header } from '@/components/header';
import { useAuth } from '@/components/auth-provider';
import { saveUserApiKeys, getUserApiKeys } from '@/actions/apiKeyActions';
import type { UserApiKeys } from '@/types/apiKeys';

interface CreditBalance {
  video_credits?: number;
  genai_credits?: number;
  partial_errors?: string[];
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(false); // Set to false initially
  const [refreshingCredits, setRefreshingCredits] = useState(false);
  const [creditsError, setCreditsError] = useState<string | null>(null);
  const { toast } = useToast();

  const [apiKeys, setApiKeys] = useState<UserApiKeys>({});
  const [loadingApiKeys, setLoadingApiKeys] = useState(true);
  const [savingApiKeys, setSavingApiKeys] = useState(false);

  const fetchCredits = useCallback(async (showRefreshToast = false) => {
    if (!user) {
      setCreditsError("User not authenticated. Cannot fetch credits.");
      return;
    }
    // Check if user has provided Picsart API key
    if (!apiKeys.picsartApiKey) {
      setCredits(null); // Clear credits if no API key
      setCreditsError("Please enter your Picsart API key to view credits.");
      setLoadingCredits(false);
      return;
    }

    try {
      setCreditsError(null);
      if (showRefreshToast) setRefreshingCredits(true);
      else setLoadingCredits(true);
      
      const idToken = await user.getIdToken();
      const response = await fetch('/api/picsart/credits', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch credit balance');
      }
      
      setCredits(data);
      
      if (showRefreshToast) {
        toast({ 
          title: 'Credits Updated', 
          description: 'Your credit balance has been refreshed.' 
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch credits';
      setCreditsError(errorMessage);
      toast({ 
        title: 'Error Fetching Credits', 
        description: errorMessage, 
        variant: 'destructive' 
      });
      setCredits(null); // Clear credits on error
    } finally {
      setLoadingCredits(false);
      setRefreshingCredits(false);
    }
  }, [user, apiKeys, toast, setLoadingCredits, setRefreshingCredits, setCredits, setCreditsError]);

  const fetchApiKeys = useCallback(async () => {
    if (!user) return;
    setLoadingApiKeys(true);
    const result = await getUserApiKeys(user.uid);
    if (result.success && result.data) {
      setApiKeys(result.data);
      // API keys fetched. Credits will be loaded on manual refresh.
      if (!result.data.picsartApiKey) {
        setCredits(null); // Clear any existing credits
        setCreditsError("Please enter your Picsart API key to view credits.");
      } else {
        setCreditsError(null); // Clear error if key exists, ready for refresh
      }
    } else {
      toast({
        title: 'Error Fetching API Keys',
        description: result.error || 'Could not load your API keys.',
        variant: 'destructive',
      });
      setCredits(null); // Clear any existing credits
      setCreditsError("Could not load API keys, cannot determine Picsart key status.");
    }
    setLoadingApiKeys(false);
    setLoadingCredits(false); // Ensure credits are not in loading state
  }, [user, toast, setLoadingApiKeys, setApiKeys, setCredits, setCreditsError, setLoadingCredits]);

  useEffect(() => {
    if (user) {
      fetchApiKeys(); // This will subsequently call fetchCredits if picsartApiKey is found
    } else {
      setLoadingApiKeys(false);
      setLoadingCredits(false);
    }
  }, [user, fetchApiKeys]); // Added fetchApiKeys to dependency array

  const handleRefreshCredits = () => {
    fetchCredits(true);
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setApiKeys(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveApiKeys = async () => {
    if (!user) {
      toast({ title: 'Error', description: 'You must be logged in to save API keys.', variant: 'destructive' });
      return;
    }
    setSavingApiKeys(true);
    const result = await saveUserApiKeys(user.uid, apiKeys);
    if (result.success) {
      toast({ title: 'API Keys Saved', description: 'Your API keys have been successfully saved.', className: 'bg-green-500 text-white' });
      // API keys saved. If Picsart key is now available, user can refresh credits.
      // If Picsart key was removed, clear credits and show appropriate message.
      if (!apiKeys.picsartApiKey) {
        setCredits(null);
        setCreditsError("Please enter your Picsart API key to view credits.");
      } else if (creditsError && creditsError.includes("Picsart API key")) {
        // If key was just added, clear the "enter key" error.
        setCreditsError(null); 
      }
      // No automatic fetchCredits call here.
    } else {
      toast({ title: 'Error Saving API Keys', description: result.error || 'Failed to save API keys.', variant: 'destructive' });
    }
    setSavingApiKeys(false);
  };

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your account settings, API keys, and view your API usage.
          </p>
        </div>

        <div className="grid gap-6">
          {/* API Key Configuration Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                API Key Configuration
              </CardTitle>
              <CardDescription>
                Manage your API keys for third-party services used by StoryTailor.
                These keys are stored securely and used for server-side operations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Security Warning</AlertTitle>
                <AlertDescription>
                  API keys provide access to paid services. Treat them like passwords.
                  These keys are stored in Firestore. For enhanced security in a production environment, consider implementing encryption at rest for these keys.
                </AlertDescription>
              </Alert>

              {loadingApiKeys ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading API key settings...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="googleApiKey">Google API Key (for Story AI & Imagen3)</Label>
                    <Input
                      id="googleApiKey"
                      name="googleApiKey"
                      type="password"
                      placeholder="Enter your Google API Key"
                      value={apiKeys.googleApiKey || ''}
                      onChange={handleApiKeyChange}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Used for core story generation, AI flows, and Imagen3 image generation.</p>
                  </div>
                  <div>
                    <Label htmlFor="geminiApiKey">Gemini API Key (Optional, for Gemini Image Gen)</Label>
                    <Input
                      id="geminiApiKey"
                      name="geminiApiKey"
                      type="password"
                      placeholder="Enter your Gemini API Key"
                      value={apiKeys.geminiApiKey || ''}
                      onChange={handleApiKeyChange}
                      className="mt-1"
                    />
                     <p className="text-xs text-muted-foreground mt-1">Used specifically for Gemini image generation if chosen.</p>
                  </div>
                  <div>
                    <Label htmlFor="elevenLabsApiKey">ElevenLabs API Key</Label>
                    <Input
                      id="elevenLabsApiKey"
                      name="elevenLabsApiKey"
                      type="password"
                      placeholder="Enter your ElevenLabs API Key"
                      value={apiKeys.elevenLabsApiKey || ''}
                      onChange={handleApiKeyChange}
                      className="mt-1"
                    />
                     <p className="text-xs text-muted-foreground mt-1">Used for ElevenLabs text-to-speech narration.</p>
                  </div>
                  <div>
                    <Label htmlFor="picsartApiKey">Picsart API Key</Label>
                    <Input
                      id="picsartApiKey"
                      name="picsartApiKey"
                      type="password"
                      placeholder="Enter your Picsart API Key"
                      value={apiKeys.picsartApiKey || ''}
                      onChange={handleApiKeyChange}
                      className="mt-1"
                    />
                     <p className="text-xs text-muted-foreground mt-1">Used for Picsart image generation and credit balance check.</p>
                  </div>
                  <div>
                    <Label htmlFor="perplexityApiKey">Perplexity API Key</Label>
                    <Input
                      id="perplexityApiKey"
                      name="perplexityApiKey"
                      type="password"
                      placeholder="Enter your Perplexity API Key"
                      value={apiKeys.perplexityApiKey || ''}
                      onChange={handleApiKeyChange}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Used for Perplexity AI models like Sonar.</p>
                  </div>
                  <Button onClick={handleSaveApiKeys} disabled={savingApiKeys} className="w-full sm:w-auto">
                    {savingApiKeys ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save API Keys
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Credit Balance Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  API Credits Balance (Picsart)
                </CardTitle>
                <CardDescription>
                  Your current Picsart API credit balance. Requires Picsart API key to be set.
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefreshCredits}
                disabled={loadingCredits || refreshingCredits || !apiKeys.picsartApiKey}
              >
                {refreshingCredits ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {loadingCredits ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading credit balance...</span>
                </div>
              ) : creditsError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{creditsError}</AlertDescription>
                </Alert>
              ) : credits ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
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
                  {credits.partial_errors && credits.partial_errors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Partial Error</AlertTitle>
                      <AlertDescription>
                        Could not fetch all credit types: {credits.partial_errors.join(', ')}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : apiKeys.picsartApiKey ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  Click the <RefreshCw className="inline h-4 w-4 mx-1" /> button to load your credit balance.
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* More Account Information (Placeholder) */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Your general account details and preferences.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Email: {user?.email || 'N/A'} <br />
                User ID: {user?.uid || 'N/A'} <br />
                (More account settings coming soon)
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
