
"use client";

import type { Story } from '@/types/story';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { getStory } from '@/actions/storyActions';
import { ArrowLeft, Clapperboard, Download, Edit3, Film, ImageIcon, Loader2, Music, Settings, Sparkles, Text, User, Video, Wand2, ZoomIn, ZoomOut, Play, Pause, Maximize, History, SidebarClose, SidebarOpen, Trash2, Copy, Scissors } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

const sidebarNavItems = [
  { name: 'AI Media', icon: Wand2 },
  { name: 'Edit', icon: Edit3 },
  { name: 'Characters', icon: User },
  { name: 'Text', icon: Text },
  { name: 'Music', icon: Music },
  { name: 'Settings', icon: Settings },
  { name: '[OLD] Chars/Locs', icon: Clapperboard, sectionBreak: true },
  { name: '[24 E6] Voices', icon: Video },
];

export default function AssembleVideoPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const storyId = searchParams.get('storyId');
  const { toast } = useToast();

  const [storyData, setStoryData] = useState<Story | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    if (!storyId) {
      toast({ title: 'Error', description: 'No story ID provided.', variant: 'destructive' });
      router.replace('/dashboard');
      return;
    }

    setPageLoading(true);
    getStory(storyId, user.uid)
      .then(response => {
        if (response.success && response.data) {
          setStoryData(response.data);
        } else {
          toast({ title: 'Error Loading Story', description: response.error || 'Failed to load story data.', variant: 'destructive' });
          router.replace('/dashboard');
        }
      })
      .finally(() => setPageLoading(false));
  }, [storyId, user, router, toast, authLoading]);

  if (pageLoading || authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="ml-4 text-xl text-foreground">Loading Video Editor...</p>
      </div>
    );
  }

  if (!storyData) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-xl text-destructive">Could not load story data.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-var(--header-height,4rem))] bg-secondary text-foreground"> {/* Adjust var name if header height is different */}
      {/* Sidebar */}
      {isSidebarOpen && (
        <aside className="w-72 bg-background border-r border-border flex flex-col p-4 space-y-4 shadow-lg">
          <div className="flex justify-between items-center">
             <Link href={`/create-story?storyId=${storyId}`} className="flex items-center text-sm text-primary hover:underline">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Story Editor
             </Link>
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)} className="md:hidden">
                <SidebarClose className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="flex-grow space-y-2 overflow-y-auto">
            {sidebarNavItems.map((item, index) => (
              <>
                {item.sectionBreak && <hr className="my-2 border-border"/>}
                <Button key={index} variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent/10">
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Button>
              </>
            ))}
          </div>

          <Card className="mt-auto">
            <CardHeader>
              <CardTitle className="text-base">History</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground h-24 overflow-y-auto">
              <p>Previous versions of images will appear here. (Placeholder)</p>
              {/* Placeholder history items */}
              {[1,2,3].map(i => (
                <div key={i} className="p-1 my-1 border rounded bg-muted/50">History item {i}</div>
              ))}
            </CardContent>
          </Card>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-background border-b border-border p-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            {!isSidebarOpen && (
                <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)} className="mr-2">
                    <SidebarOpen className="h-5 w-5" />
                </Button>
            )}
            <Sparkles className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-semibold truncate" title={storyData.title}>
              {storyData.title}
            </h1>
          </div>
          <Button variant="default" className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled>
            <Download className="w-4 h-4 mr-2" />
            Export (Coming Soon)
          </Button>
        </div>

        {/* Video Preview & Timeline */}
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
          {/* Video Preview */}
          <div className="flex-1 bg-muted rounded-lg flex items-center justify-center shadow-inner">
            {storyData.generatedImages && storyData.generatedImages.length > 0 && storyData.generatedImages[0] ? (
                 <Image 
                    src={storyData.generatedImages[0].imageUrl} 
                    alt="Video Preview Placeholder" 
                    width={800} 
                    height={450} 
                    className="max-w-full max-h-full object-contain rounded-md"
                    data-ai-hint={storyData.generatedImages[0].dataAiHint || "story image"}
                  />
            ) : (
                <Video className="w-24 h-24 text-muted-foreground/50" />
            )}
          </div>

          {/* Timeline Controls */}
          <div className="bg-background p-2 rounded-md shadow-sm border border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" disabled><Play className="w-5 h-5" /></Button>
              <Button variant="ghost" size="icon" disabled><Pause className="w-5 h-5" /></Button>
              <Button variant="ghost" size="icon" disabled><Scissors className="w-5 h-5" /></Button>
              <Button variant="ghost" size="icon" disabled><Trash2 className="w-5 h-5" /></Button>
              <Button variant="ghost" size="icon" disabled><Copy className="w-5 h-5" /></Button>
            </div>
            <span className="text-sm text-muted-foreground">0:00 / {storyData.narrationAudioDurationSeconds ? (storyData.narrationAudioDurationSeconds / 60).toFixed(2).replace('.',':') : '0:00'}</span>
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" disabled><History className="w-5 h-5" /></Button>
                <Button variant="ghost" size="icon" disabled><ZoomOut className="w-5 h-5" /></Button>
                <Button variant="ghost" size="icon" disabled><ZoomIn className="w-5 h-5" /></Button>
                <Button variant="ghost" size="icon" disabled><Maximize className="w-5 h-5" /></Button>
            </div>
          </div>

          {/* Timeline */}
          <ScrollArea className="h-32 bg-background p-2 rounded-md shadow-sm border border-border">
            <div className="flex space-x-2 pb-2">
              {storyData.generatedImages?.map((img, index) => (
                <div key={index} className="flex-shrink-0 w-28 h-28 rounded-md overflow-hidden border-2 border-transparent hover:border-primary cursor-pointer shadow">
                   {img ? (
                    <Image 
                        src={img.imageUrl} 
                        alt={`Scene ${index + 1}`} 
                        width={112} 
                        height={112} 
                        objectFit="cover"
                        className="w-full h-full"
                        data-ai-hint={img.dataAiHint || "timeline thumbnail"}
                    />
                   ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground/50"/>
                    </div>
                   )}
                </div>
              ))}
              {(!storyData.generatedImages || storyData.generatedImages.length === 0) && (
                <div className="text-muted-foreground text-sm p-4">No images to display in timeline.</div>
              )}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </main>
    </div>
  );
}
