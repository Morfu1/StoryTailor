import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { Label } from '@/components/ui/label'; // Unused
import { Button } from '@/components/ui/button';
import { Users, MapPin, Package, Clapperboard, Download } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { ImagePopup } from '@/components/ui/image-popup';
import { useToast } from '@/hooks/use-toast';
import { categorizeImages, getSceneName } from '@/utils/storyHelpers';
import type { UseStoryStateReturn } from '@/hooks/useStoryState';
import type { GeneratedImage } from '@/types/story'; // Import GeneratedImage

interface ImageCategorizerProps {
  storyState: UseStoryStateReturn;
}

export function ImageCategorizer({ storyState }: ImageCategorizerProps) {
  const { storyData } = storyState;
  const { toast } = useToast();
  const [popupImage, setPopupImage] = useState<{ src: string; alt: string } | null>(null);
  
  const { characters, locations, items, scenes } = categorizeImages(storyData);

  const handleDownloadImage = async (imageUrl: string, alt: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${alt.replace(/\s+/g, '_')}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: 'Image Downloaded',
        description: 'The image has been saved to your device.',
        className: 'bg-green-500 text-white'
      });
    } catch (error) {
      console.error('Error downloading image:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to download the image.',
        variant: 'destructive'
      });
    }
  };

  const renderImageGrid = (images: GeneratedImage[], title: string, icon: React.ReactNode) => {
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {images.map((image, index) => {
              const imageAlt = title === 'Scenes' ? getSceneName(image.originalPrompt, index) : image.originalPrompt.substring(0, 30);
              
              return (
                <div key={`${title}-${index}`} className="space-y-3">
                  <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted group shadow-sm">
                    <Image
                      src={image.imageUrl}
                      alt={imageAlt}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      style={{ objectFit: "cover" }}
                      className="transition-transform hover:scale-105 cursor-pointer"
                      unoptimized
                      onClick={() => setPopupImage({ src: image.imageUrl, alt: imageAlt })}
                    />
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          const downloadAlt = `${title.slice(0, -1)}_${index + 1}`;
                          handleDownloadImage(image.imageUrl, downloadAlt);
                        }}
                        className="bg-white/90 hover:bg-white text-black"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                <div className="space-y-1">
                <p className="text-sm font-medium line-clamp-2">
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
              );
            })}
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
      
      <ImagePopup
        src={popupImage?.src || ''}
        alt={popupImage?.alt || ''}
        isOpen={!!popupImage}
        onClose={() => setPopupImage(null)}
      />
    </div>
  );
}
