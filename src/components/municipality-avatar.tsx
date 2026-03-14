"use client";

import { useState } from "react";
import municipalityLogos from "@/lib/municipality-logos.json";

interface MunicipalityAvatarProps {
  slug: string;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: { container: "h-6 w-6 text-[10px]", img: 24 },
  md: { container: "h-8 w-8 text-xs", img: 32 },
  lg: { container: "h-10 w-10 text-sm", img: 40 },
};

function getLogoPath(slug: string): string | null {
  return (municipalityLogos as Record<string, string>)[slug] || null;
}

function getInitials(name: string): string {
  const words = name.replace(/[^a-zA-Z\s]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return words.slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 40%, 35%)`;
}

export function MunicipalityAvatar({
  slug,
  name,
  size = "md",
  className = "",
}: MunicipalityAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const logoPath = getLogoPath(slug);
  const { container, img } = sizes[size];

  if (logoPath && !imgError) {
    return (
      <img
        src={logoPath}
        alt={name}
        width={img}
        height={img}
        className={`rounded-md object-contain shrink-0 ${container} ${className}`}
        onError={() => setImgError(true)}
        loading="lazy"
      />
    );
  }

  // Fallback: colored initials
  return (
    <div
      className={`inline-flex items-center justify-center rounded-md font-bold text-white shrink-0 ${container} ${className}`}
      style={{ backgroundColor: hashColor(name) }}
      title={name}
      aria-hidden="true"
    >
      {getInitials(name)}
    </div>
  );
}
