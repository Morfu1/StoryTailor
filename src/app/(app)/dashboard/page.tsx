"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/auth-provider';
import type { Story } from '@/types/story';
import { PlusCircle, FileText, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {formatDistanceToNow} from 'date-fns';


export default function DashboardPage() {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const fetchStories = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const storiesCol = collection(db, 'stories');
          const q = query(storiesCol, where('userId', '==', user.uid), orderBy('updatedAt', 'desc'));
          const querySnapshot = await getDocs(q);
          const userStories: Story[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Story));
          setStories(userStories);
        } catch (err) {
          console.error("Error fetching stories:", err);
          setError("Failed to load your stories. Please try again later.");
        } finally {
          setIsLoading(false);
        }
      };
      fetchStories();
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Loading your magical tales...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="mt-4 text-lg text-destructive">{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">Retry</Button>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Your Story Collection</h1>
          <p className="text-muted-foreground">
            Revisit your adventures or craft new ones.
          </p>
        </div>
        <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Link href="/create-story">
            <PlusCircle className="mr-2 h-5 w-5" /> Create New Story
          </Link>
        </Button>
      </div>

      {stories.length === 0 ? (
        <Card className="text-center py-12 shadow-lg bg-card">
          <CardHeader>
            <div className="mx-auto rounded-full bg-primary/10 p-4 w-fit">
                <FileText className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="mt-4 text-2xl font-semibold text-foreground">No Stories Yet</CardTitle>
            <CardDescription className="text-muted-foreground">
              It looks like your book of tales is empty. <br/> Start your first adventure now!
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Link href="/create-story">
                <PlusCircle className="mr-2 h-5 w-5" /> Create Your First Story
              </Link>
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stories.map((story) => (
            <Card key={story.id} className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 bg-card">
              <CardHeader>
                 <div className="aspect-[16/9] bg-muted rounded-t-md overflow-hidden relative">
                  <Image 
                    src={story.generatedImages?.[0]?.imageUrl || "https://picsum.photos/400/225"} 
                    alt={story.title} 
                    layout="fill" 
                    objectFit="cover"
                    data-ai-hint="fantasy landscape"
                  />
                </div>
                <CardTitle className="mt-4 text-xl font-semibold text-foreground truncate">
                  {story.title || 'Untitled Story'}
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground h-10 overflow-hidden">
                  {story.userPrompt ? `${story.userPrompt.substring(0, 60)}...` : 'No prompt provided.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-xs text-muted-foreground">
                  Last updated: {story.updatedAt ? formatDistanceToNow(new Date( (story.updatedAt as any).seconds * 1000), { addSuffix: true }) : 'N/A'}
                </p>
              </CardContent>
              <CardFooter>
                <Button asChild variant="outline" className="w-full">
                  {/* Link to view/edit story page - to be implemented */}
                  <Link href={`/create-story?storyId=${story.id}`}>View & Edit</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
