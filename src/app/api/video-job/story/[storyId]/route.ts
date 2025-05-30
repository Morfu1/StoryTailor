import { NextResponse } from 'next/server';
import { getJobsForStory } from '@/utils/videoJobManager';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;
    
    if (!storyId) {
      return NextResponse.json(
        { error: 'Story ID is required' },
        { status: 400 }
      );
    }
    
    const jobs = getJobsForStory(storyId);
    
    return NextResponse.json(jobs);
  } catch (error) {
    console.error('Error getting jobs for story:', error);
    return NextResponse.json(
      { error: 'Failed to get jobs for story' },
      { status: 500 }
    );
  }
}
