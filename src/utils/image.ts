const BASE =
  "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=";

export type ImageSize =
  | "square_hd"
  | "square"
  | "portrait_4_3"
  | "portrait_16_9"
  | "landscape_4_3"
  | "landscape_16_9";

export function t2i(prompt: string, imageSize: ImageSize) {
  return `${BASE}${encodeURIComponent(prompt)}&image_size=${imageSize}`;
}

