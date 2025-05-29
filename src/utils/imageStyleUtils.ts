import { IMAGE_STYLES, DEFAULT_STYLE_ID, type ImageStyleId } from '@/types/imageStyles';

export function getStylePromptForProvider(
  styleId: ImageStyleId | undefined,
  provider: 'picsart' | 'gemini' | 'imagen3'
): string {
  const style = IMAGE_STYLES[styleId || DEFAULT_STYLE_ID];
  
  switch (provider) {
    case 'picsart':
      return style.fluxPrompt;
    case 'gemini':
      return style.geminiPrompt;
    case 'imagen3':
      return style.imagen3Prompt;
    default:
      return style.fluxPrompt;
  }
}

export function applyStyleToPrompt(
  cleanPrompt: string,
  styleId: ImageStyleId | undefined,
  provider: 'picsart' | 'gemini' | 'imagen3'
): string {
  const stylePrompt = getStylePromptForProvider(styleId, provider);
  return `${cleanPrompt}, ${stylePrompt}`;
}

export function getStyleName(styleId: ImageStyleId | undefined): string {
  const style = IMAGE_STYLES[styleId || DEFAULT_STYLE_ID];
  return style.name;
}

export function getStyleDescription(styleId: ImageStyleId | undefined): string {
  const style = IMAGE_STYLES[styleId || DEFAULT_STYLE_ID];
  return style.description;
}
