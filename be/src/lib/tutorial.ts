/**
 * Tutorial videos (mouth shape per exercise), served from be/public/tutorial/<itemId>.mp4.
 * The file name is the curriculum item id, e.g. t1-a.mp4, t3-ma.mp4, t4-mama.mp4.
 *
 * ponytail: the file list is read once at start; restart the server after adding videos.
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { config } from "../config";

export const TUTORIAL_DIR = path.resolve(import.meta.dirname, "../../public/tutorial");

const available = new Set(
  (() => {
    try {
      return readdirSync(TUTORIAL_DIR).filter((f) => f.endsWith(".mp4")).map((f) => f.slice(0, -4));
    } catch {
      return [];
    }
  })(),
);

/** Full URL of the item's tutorial video, or null when there is none. */
export function tutorialUrl(itemId: string): string | null {
  if (!available.has(itemId)) return null;
  return `${(config.PUBLIC_URL ?? "").replace(/\/$/, "")}/tutorial/${encodeURIComponent(itemId)}.mp4`;
}
