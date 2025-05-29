export interface ImageStyle {
  id: string;
  name: string;
  description: string;
  fluxPrompt: string; // The style descriptor to append to prompts for Flux
  geminiPrompt: string; // Style descriptor for Gemini
  imagen3Prompt: string; // Style descriptor for Imagen3
  preview?: string; // Optional preview image URL
}

export const IMAGE_STYLES: Record<string, ImageStyle> = {
  '3d-animation': {
    id: '3d-animation',
    name: '3D Animation',
    description: 'Disney Pixar style 3D animated characters and scenes',
    fluxPrompt: 'disney style, pixar style, 3d model',
    geminiPrompt: '3D rendered, Disney Pixar cartoon style, vibrant colors',
    imagen3Prompt: 'Disney Pixar 3D animation style, colorful, family-friendly'
  },
  'photorealistic': {
    id: 'photorealistic',
    name: 'Photorealistic',
    description: 'Realistic, lifelike images that look like photographs',
    fluxPrompt: 'photorealistic, realistic, high detail',
    geminiPrompt: 'photorealistic, realistic photography, natural lighting',
    imagen3Prompt: 'photorealistic, lifelike, detailed, natural'
  },
  'sketched': {
    id: 'sketched',
    name: 'Sketched',
    description: 'Hand-drawn pencil sketch style',
    fluxPrompt: 'pencil sketch, hand drawn, line art, sketchy',
    geminiPrompt: 'pencil sketch, black and white drawing, artistic sketch',
    imagen3Prompt: 'pencil sketch, hand-drawn, artistic line drawing'
  },
  'ghibli': {
    id: 'ghibli',
    name: 'Studio Ghibli',
    description: 'Studio Ghibli anime style with soft colors and dreamy atmosphere',
    fluxPrompt: 'studio ghibli style, anime, soft colors, dreamy',
    geminiPrompt: 'Studio Ghibli animation style, soft watercolor, anime',
    imagen3Prompt: 'Studio Ghibli style, anime, soft pastel colors, dreamy'
  },
  'eightbit': {
    id: 'eightbit',
    name: '8-bit Pixel Art',
    description: 'Retro 8-bit video game pixel art style',
    fluxPrompt: '8-bit pixel art, retro game style, pixelated',
    geminiPrompt: '8-bit pixel art, retro video game style, low resolution',
    imagen3Prompt: '8-bit pixel art, retro gaming, pixelated, low-res'
  },
  'kurz-gesagt': {
    id: 'kurz-gesagt',
    name: 'Kurzgesagt',
    description: 'Flat design infographic style with bold colors',
    fluxPrompt: 'kurzgesagt style, flat design, infographic, bold colors',
    geminiPrompt: 'flat design, infographic style, minimalist, bold colors',
    imagen3Prompt: 'flat design, infographic style, simple shapes, vibrant'
  },
  'infographics': {
    id: 'infographics',
    name: 'Infographics',
    description: 'Clean infographic style with charts and data visualization',
    fluxPrompt: 'infographic style, clean design, data visualization',
    geminiPrompt: 'infographic, clean design, business illustration',
    imagen3Prompt: 'infographic style, clean, professional, data visualization'
  },
  'pooh': {
    id: 'pooh',
    name: 'Classic Book Illustration',
    description: 'Classic children\'s book illustration style like Winnie the Pooh',
    fluxPrompt: 'classic book illustration, watercolor, storybook art',
    geminiPrompt: 'classic children\'s book illustration, soft watercolor',
    imagen3Prompt: 'classic storybook illustration, watercolor, vintage'
  }
};

export type ImageStyleId = keyof typeof IMAGE_STYLES;

export const DEFAULT_STYLE_ID: ImageStyleId = '3d-animation';
