import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, AlertCircle, Film } from 'lucide-react';
import { ImageCategorizer } from './ImageCategorizer';
import { countSceneImages, countDetailImages } from '@/utils/storyHelpers';
import type { UseStoryStateReturn } from '@/hooks/useStoryState';

interface FinalReviewStepProps {
  storyState: UseStoryStateReturn;
}

export function FinalReviewStep({ storyState }: FinalReviewStepProps) {
  const { storyData } = storyState;

  const isStoryComplete = Boolean(
    storyData.title &&
    storyData.generatedScript &&
    storyData.narrationChunks &&
    storyData.narrationChunks.length > 0 &&
    storyData.narrationChunks.every(c => c.audioUrl) &&
    storyData.imagePrompts &&
    storyData.imagePrompts.length > 0
  );

  const totalSceneImages = storyData.imagePrompts?.length || 0;
  const generatedSceneImages = countSceneImages(storyData);

  if (!storyData.imagePrompts || storyData.imagePrompts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" />
            Step 5: Final Review & Export
          </CardTitle>
          <CardDescription>
            Generate scene images first to continue with the final review.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="h-5 w-5" />
          Step 5: Final Review & Export
        </CardTitle>
        <CardDescription>
          Review your complete story and save or export it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Story Completion Status */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Story Completion Status</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle className={`h-4 w-4 ${storyData.title ? 'text-green-500' : 'text-muted-foreground'}`} />
              <span className="text-sm">Title: {storyData.title || 'Not set'}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <CheckCircle className={`h-4 w-4 ${storyData.generatedScript ? 'text-green-500' : 'text-muted-foreground'}`} />
              <span className="text-sm">Script Generated</span>
            </div>
            
            <div className="flex items-center gap-2">
              <CheckCircle className={`h-4 w-4 ${storyData.narrationChunks?.every(c => c.audioUrl) ? 'text-green-500' : 'text-muted-foreground'}`} />
              <span className="text-sm">
                Narration: {storyData.narrationChunks?.filter(c => c.audioUrl).length || 0}/{storyData.narrationChunks?.length || 0} chunks
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <CheckCircle className={`h-4 w-4 ${generatedSceneImages === totalSceneImages && totalSceneImages > 0 ? 'text-green-500' : 'text-muted-foreground'}`} />
              <span className="text-sm">
                Scene Images: {generatedSceneImages}/{totalSceneImages}
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Story Summary */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Story Summary</Label>
          <div className="p-4 border rounded-md bg-muted/50">
            <h3 className="font-semibold mb-2">{storyData.title || 'Untitled Story'}</h3>
            <p className="text-sm text-muted-foreground mb-3">{storyData.userPrompt}</p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">Script Length:</span>
                <br />
                {storyData.generatedScript?.length || 0} characters
                <br />
                {storyData.generatedScript ? storyData.generatedScript.trim().split(/\s+/).length : 0} words
              </div>
              
              <div>
                <span className="font-medium">Audio Duration:</span>
                <br />
                {storyData.narrationAudioDurationSeconds ? 
                  `${Math.round(storyData.narrationAudioDurationSeconds / 60)}:${String(Math.round(storyData.narrationAudioDurationSeconds % 60)).padStart(2, '0')}` : 
                  'Not calculated'
                }
              </div>
              
              <div>
                <span className="font-medium">Detail Images:</span>
                <br />
                {countDetailImages(storyData)}
              </div>
              
              <div>
                <span className="font-medium">Scene Images:</span>
                <br />
                {generatedSceneImages}
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Generated Images */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Generated Images</Label>
          <ImageCategorizer storyState={storyState} />
        </div>

        <Separator />

        {/* Status Messages */}
        <div className="space-y-4">
          {!isStoryComplete && (
            <div className="flex items-start gap-2 p-3 border border-yellow-200 bg-yellow-50 rounded-md">
              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800">Story Not Complete</p>
                <p className="text-yellow-700">
                  Some elements are missing. Complete all steps for the best experience.
                </p>
              </div>
            </div>
          )}
          
          {isStoryComplete && (
            <div className="text-center p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Story Complete!</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Your story is ready. Use the Save Story button below to save your progress.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
