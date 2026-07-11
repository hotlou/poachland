"use client";

import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { STOCK_PHOTOS } from "@/lib/constants";
import type { ItemType } from "@/lib/types";

const MAX_PHOTOS = 4;
const MAX_EDGE = 800;

/** Downscale an uploaded image to a small JPEG data URL (localStorage-safe). */
async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

/**
 * Photo selection for create/edit listing: pick from stock item photos
 * and/or upload device photos (downscaled to keep the demo store small).
 */
export function PhotoPicker({
  photos,
  onChange,
  itemType,
}: {
  photos: string[];
  onChange: (photos: string[]) => void;
  itemType: ItemType;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const stock = STOCK_PHOTOS[itemType];

  const toggle = (url: string) => {
    if (photos.includes(url)) {
      onChange(photos.filter((p) => p !== url));
    } else if (photos.length >= MAX_PHOTOS) {
      toast.error(`Max ${MAX_PHOTOS} photos`);
    } else {
      onChange([...photos, url]);
    }
  };

  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {photos.map((url, i) => (
            <div
              key={url}
              className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-accent"
            >
              <img src={url} alt={`Photo ${i + 1}`} className="absolute inset-0 w-full h-full object-cover" />
              {i === 0 && (
                <span className="absolute bottom-0 left-0 right-0 bg-accent text-accent-foreground text-[9px] font-display font-bold uppercase text-center">
                  Cover
                </span>
              )}
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => onChange(photos.filter((p) => p !== url))}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center text-white"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="text-xs text-muted-foreground mb-1.5">
          Pick from sample photos ({photos.length}/{MAX_PHOTOS})
        </p>
        <div className="flex gap-2 flex-wrap">
          {stock.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => toggle(url)}
              className={cn(
                "relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors",
                photos.includes(url) ? "border-accent" : "border-border hover:border-muted-foreground",
              )}
            >
              <img src={url} alt="Stock photo" className="absolute inset-0 w-full h-full object-cover" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-16 h-16 rounded-lg border-2 border-dashed border-border hover:border-accent flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-accent transition-colors"
          >
            <ImagePlus size={18} />
            <span className="text-[9px] font-medium">Upload</span>
          </button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          const room = MAX_PHOTOS - photos.length;
          if (files.length > room) toast.error(`Only ${room} photo slot${room === 1 ? "" : "s"} left`);
          const added: string[] = [];
          for (const file of files.slice(0, room)) {
            try {
              added.push(await fileToDataUrl(file));
            } catch {
              toast.error(`Couldn't read ${file.name}`);
            }
          }
          if (added.length) onChange([...photos, ...added]);
        }}
      />
    </div>
  );
}
