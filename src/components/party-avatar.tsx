"use client";

import { useState } from "react";
import { getPartyColor, getPartyInitials } from "@/lib/party-colors";
import partyLogos from "@/lib/party-logos.json";

interface PartyAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: { container: "h-6 w-6 text-[10px]", img: 24 },
  md: { container: "h-8 w-8 text-xs", img: 32 },
  lg: { container: "h-10 w-10 text-sm", img: 40 },
};

function getLogoPath(name: string): string | null {
  const logos = partyLogos as Record<string, string>;
  // Exact match
  if (logos[name]) return logos[name];
  // Match if name starts with a known key (e.g., "CDA Montferland" matches "CDA")
  // Only for keys >= 3 chars to avoid false positives
  for (const [key, logoPath] of Object.entries(logos)) {
    if (key.length >= 3 && name.startsWith(key + " ")) return logoPath;
  }
  return null;
}

export function PartyAvatar({ name, size = "md", className = "" }: PartyAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const color = getPartyColor(name);
  const initials = getPartyInitials(name);
  const logoPath = getLogoPath(name);
  const { container, img } = sizes[size];

  // Use real logo if available and not errored
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

  // Fallback: color initials avatar
  return (
    <div
      className={`inline-flex items-center justify-center rounded-md font-bold text-white shrink-0 ${container} ${className}`}
      style={{ backgroundColor: color }}
      title={name}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
