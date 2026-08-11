import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Resolve an attachment path to a full URL using VITE_API_BASE_URL_ATTACHMENT.
 * Strips any existing origin (http://host:port) from stored paths and replaces it.
 * Falls back to VITE_API_BASE_URL (without /api) if VITE_API_BASE_URL_ATTACHMENT is not set.
 */
export function resolveAttachmentUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL_ATTACHMENT as string)
    || (import.meta.env.VITE_API_BASE_URL as string)?.replace(/\/api\/?$/, '')
    || '';

  // Strip any existing protocol+host from the path
  const cleanedPath = path.replace(/^https?:\/\/[^/]+/, '');

  return `${base}${cleanedPath}`;
}
