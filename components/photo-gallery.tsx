"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface PhotoGalleryProps {
  photos: string[];
  alt: string;
}

export function PhotoGallery({ photos, alt }: PhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;
    if (diff > threshold && activeIndex < photos.length - 1) {
      setActiveIndex((i) => i + 1);
    } else if (diff < -threshold && activeIndex > 0) {
      setActiveIndex((i) => i - 1);
    }
  }, [activeIndex, photos.length]);

  if (photos.length === 0) return null;

  return (
    <div className="relative">
      {/* Main image */}
      <div
        className="relative aspect-[4/3] overflow-hidden bg-surface"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Image
          src={photos[activeIndex]}
          alt={`${alt} — photo ${activeIndex + 1}`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 512px"
          priority
        />
        {/* Photo count pill */}
        {photos.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full">
            {activeIndex + 1} / {photos.length}
          </div>
        )}
      </div>

      {/* Dot indicators */}
      {photos.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all pointer-events-auto",
                i === activeIndex
                  ? "bg-accent w-4"
                  : "bg-white/40 hover:bg-white/60",
              )}
              aria-label={`View photo ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div className="flex gap-2 px-4 mt-3 overflow-x-auto scrollbar-hide">
          {photos.map((photo, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={cn(
                "relative flex-shrink-0 w-16 h-16 rounded-sm overflow-hidden border-2 transition-all",
                i === activeIndex
                  ? "border-accent opacity-100"
                  : "border-transparent opacity-50 hover:opacity-75",
              )}
            >
              <Image
                src={photo}
                alt={`Thumbnail ${i + 1}`}
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
