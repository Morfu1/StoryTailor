import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Users, MapPin, Package, Clapperboard } from 'lucide-react';
import Image from 'next/image';
import { categorizeImages, getSceneName } from '@/utils/storyHelpers';
import type { UseStoryStateReturn } from '@/hooks/useStoryState';

interface ImageCategorizerProps {
  storyState: UseStoryStateReturn;
}

export function ImageCategorizer({ storyState }: ImageCategorizerProps) {
  const { storyData } = storyState;
  
  const { characters, locations, items, scenes } = categorizeImages(storyData);

  const renderImageGrid = (images: any[], title: string, icon: React.ReactNode) => {
    if (images.length === 0) {
      return (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              {icon}
              {title} (0)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">No {title.toLowerCase()} images generated yet.</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            {icon}
            {title} ({images.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map((image, index) => (
              <div key={`${title}-${index}`} className="space-y-2">
                <div className="relative aspect-square overflow-hidden rounded-md border bg-muted">
                  <Image
                    src={image.imageUrl}
                    alt={title === 'Scenes' ? getSceneName(image.originalPrompt, index) : image.originalPrompt.substring(0, 30)}
                    fill
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                    style={{ objectFit: "cover" }}
                    className="transition-transform hover:scale-105"
                    unoptimized
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium line-clamp-2">
                    {title === 'Scenes' ? getSceneName(image.originalPrompt, index) : 
                     image.originalPrompt.substring(0, 40) + (image.originalPrompt.length > 40 ? '...' : '')}
                  </p>
                  {image.requestPrompt && image.requestPrompt !== image.originalPrompt && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      Full: {image.requestPrompt.substring(0, 50)}...
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!storyData.generatedImages || storyData.generatedImages.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground">No images generated yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderImageGrid(characters, 'Characters', <Users className="h-4 w-4" />)}
        {renderImageGrid(locations, 'Locations', <MapPin className="h-4 w-4" />)}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderImageGrid(items, 'Items', <Package className="h-4 w-4" />)}
        {renderImageGrid(scenes, 'Scenes', <Clapperboard className="h-4 w-4" />)}
      </div>

      {/* Debug information */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Debug: Image Categorization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs space-y-1">
              <p>Total images: {storyData.generatedImages.length}</p>
              <p>Characters: {characters.length}</p>
              <p>Locations: {locations.length}</p>
              <p>Items: {items.length}</p>
              <p>Scenes: {scenes.length}</p>
              <p>Uncategorized: {storyData.generatedImages.length - characters.length - locations.length - items.length - scenes.length}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
