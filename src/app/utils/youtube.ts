/**
 * Extract the YouTube video ID from common URL formats.
 *
 * Supports:
 *   - youtu.be/<id>
 *   - youtube.com/embed/<id>
 *   - youtube.com/watch?v=<id>
 *   - youtube.com/v/<id>
 *
 * Returns `null` when the URL is empty or doesn't match a known format.
 */
export function extractYoutubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;

  // youtu.be/<id>
  let match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];

  // youtube.com/embed/<id>
  match = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];

  // youtube.com/watch?v=<id>
  match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];

  // youtube.com/v/<id>
  match = url.match(/youtube\.com\/v\/([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];

  // youtube.com/shorts/<id>
  match = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];

  // youtu.be/shorts/<id>
  match = url.match(/youtu\.be\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];

  return null;
}

/**
 * Build the embed URL for a YouTube iframe from a watch/share URL.
 *
 * Returns `null` when the video ID can't be extracted.
 */
export function buildYoutubeEmbedUrl(url: string | null | undefined): string | null {
  const id = extractYoutubeVideoId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}
