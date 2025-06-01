"use client";

import { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export function FirebaseTroubleshooter() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="mb-6 border-amber-300">
      <CardHeader className="bg-amber-50 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-amber-600 mr-2" />
            <CardTitle className="text-lg text-amber-800">Firebase Connection Troubleshooter</CardTitle>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsOpen(!isOpen)}
            className="text-amber-800 hover:text-amber-900 hover:bg-amber-100"
          >
            {isOpen ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Hide
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Show
              </>
            )}
          </Button>
        </div>
        <CardDescription className="text-amber-700">
          Having trouble connecting to Firebase? This guide will help you resolve common issues.
        </CardDescription>
      </CardHeader>
      
      {isOpen && (
        <CardContent className="pt-4">
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="ad-blockers">
              <AccordionTrigger className="text-amber-900 hover:text-amber-700">
                Ad Blockers & Privacy Extensions
              </AccordionTrigger>
              <AccordionContent className="text-amber-800">
                <p className="mb-2">
                  Ad blockers and privacy extensions like uBlock Origin, Privacy Badger, or AdGuard can block Firebase connections.
                </p>
                <h4 className="font-semibold mt-3 mb-1">How to fix:</h4>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Temporarily disable your ad blocker for this site</li>
                  <li>Add this site to your ad blocker&apos;s whitelist/allowlist</li>
                  <li>If using uBlock Origin:
                    <ul className="list-disc pl-5 mt-1">
                      <li>Click the uBlock icon in your browser</li>
                      <li>Click the power button to disable it for this site</li>
                      <li>Refresh the page</li>
                    </ul>
                  </li>
                </ol>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="browser-settings">
              <AccordionTrigger className="text-amber-900 hover:text-amber-700">
                Browser Privacy Settings
              </AccordionTrigger>
              <AccordionContent className="text-amber-800">
                <p className="mb-2">
                  Some browsers have built-in privacy features that can block Firebase connections.
                </p>
                <h4 className="font-semibold mt-3 mb-1">How to fix:</h4>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Check if your browser is blocking third-party cookies</li>
                  <li>Disable &quot;Enhanced Tracking Protection&quot; for this site (Firefox)</li>
                  <li>Try using a different browser temporarily</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="network-issues">
              <AccordionTrigger className="text-amber-900 hover:text-amber-700">
                Network Issues
              </AccordionTrigger>
              <AccordionContent className="text-amber-800">
                <p className="mb-2">
                  Corporate networks, VPNs, or firewalls might block Firebase connections.
                </p>
                <h4 className="font-semibold mt-3 mb-1">How to fix:</h4>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Try accessing the site from a different network</li>
                  <li>Disable VPN if you&apos;re using one</li>
                  <li>Check if your network administrator has blocked Firebase domains</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="browser-extensions">
              <AccordionTrigger className="text-amber-900 hover:text-amber-700">
                Other Browser Extensions
              </AccordionTrigger>
              <AccordionContent className="text-amber-800">
                <p className="mb-2">
                  Some browser extensions can interfere with Firebase connections.
                </p>
                <h4 className="font-semibold mt-3 mb-1">How to fix:</h4>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Try using incognito/private browsing mode (extensions are usually disabled)</li>
                  <li>Temporarily disable all browser extensions and refresh</li>
                  <li>Re-enable extensions one by one to identify the problematic one</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="still-issues">
              <AccordionTrigger className="text-amber-900 hover:text-amber-700">
                Still Having Issues?
              </AccordionTrigger>
              <AccordionContent className="text-amber-800">
                <p className="mb-2">
                  If you&apos;ve tried all the above solutions and still can&apos;t connect:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Clear your browser cache and cookies</li>
                  <li>Try a different browser</li>
                  <li>Check if Firebase is experiencing an outage:
                    <a 
                      href="https://status.firebase.google.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 inline-flex items-center ml-1"
                    >
                      Firebase Status <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </li>
                  <li>Contact support for further assistance</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      )}
    </Card>
  );
}