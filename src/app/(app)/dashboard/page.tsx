
"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/auth-provider';
import type { Story } from '@/types/story';
import { PlusCircle, FileText, Loader2, AlertTriangle, Film, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {formatDistanceToNow} from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteStory } from '@/actions/firestoreStoryActions'; // Corrected import path

export default function DashboardPage() {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingStoryId, setDeletingStoryId] = useState<string | null>(null);
  const { toast } = useToast();

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

  const handleDeleteStory = async (storyId: string, storyTitle: string) => {
    if (!user) {
      toast({ title: 'Error', description: 'User not authenticated.', variant: 'destructive' });
      return;
    }

    setDeletingStoryId(storyId);
    
    try {
      // The import for deleteStory is now at the top of the file
      const result = await deleteStory(storyId, user.uid);
      
      if (result.success) {
        toast({ 
          title: 'Story Deleted!', 
          description: `"${storyTitle}" has been permanently deleted.`, 
          className: 'bg-green-500 text-white' 
        });
        
        setStories(prevStories => prevStories.filter(story => story.id !== storyId));
      } else {
        toast({ 
          title: 'Delete Failed', 
          description: result.error || 'Failed to delete story.', 
          variant: 'destructive' 
        });
      }
    } catch (error) {
      console.error('Error deleting story:', error);
      toast({ 
        title: 'Delete Error', 
        description: 'An unexpected error occurred while deleting the story.', 
        variant: 'destructive' 
      });
    } finally {
      setDeletingStoryId(null);
    }
  };

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
          {stories.map((story, index) => (
            <Card key={story.id} className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 bg-card relative">
            <div className="absolute top-2 right-2 z-10">
            <AlertDialog>
            <AlertDialogTrigger asChild>
            <Button 
              variant="destructive" 
              size="sm" 
                className="w-8 h-8 p-0 bg-destructive/80 hover:bg-destructive backdrop-blur-sm"
                  disabled={deletingStoryId === story.id}
                     >
                       {deletingStoryId === story.id ? (
                         <Loader2 className="h-4 w-4 animate-spin" />
                       ) : (
                         <Trash2 className="h-4 w-4" />
                       )}
                     </Button>
                   </AlertDialogTrigger>
                   <AlertDialogContent>
                     <AlertDialogHeader>
                       <AlertDialogTitle>Delete Story</AlertDialogTitle>
                       <AlertDialogDescription>
                         Are you sure you want to delete "<strong>{story.title}</strong>"? This action cannot be undone and will permanently delete the story and all its associated files (images, audio, etc.).
                       </AlertDialogDescription>
                     </AlertDialogHeader>
                     <AlertDialogFooter>
                       <AlertDialogCancel>Cancel</AlertDialogCancel>
                       <AlertDialogAction 
                         onClick={() => handleDeleteStory(story.id!, story.title)}
                         className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                       >
                         <Trash2 className="mr-2 h-4 w-4" />
                         Delete Permanently
                       </AlertDialogAction>
                     </AlertDialogFooter>
                   </AlertDialogContent>
                 </AlertDialog>
               </div>
               
               <CardHeader>
                  <div className="aspect-[16/9] bg-muted rounded-t-md overflow-hidden relative">
                   <Image 
                     src={story.generatedImages?.[0]?.imageUrl || "https://placehold.co/400x225.png"} 
                     alt={story.title || "Story image"} 
                     fill
                     style={{ objectFit: "cover" }}
                     priority={index === 0}
                     sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                     data-ai-hint="story cover"
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
              <CardFooter className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row gap-2 w-full">
              <Button asChild variant="outline" className="flex-1">
              <Link href={`/create-story?storyId=${story.id}`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Story
              </Link>
              </Button>
              <Button asChild variant="default" className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href={`/assemble-video?storyId=${story.id}`}>
              <Film className="mr-2 h-4 w-4" />
              Edit Video
              </Link>
              </Button>
              </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
