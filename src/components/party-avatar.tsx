"use client";

import { getPartyColor, getPartyInitials } from "@/lib/party-colors";

interface PartyAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
};

export function PartyAvatar({ name, size = "md", className = "" }: PartyAvatarProps) {
  const color = getPartyColor(name);
  const initials = getPartyInitials(name);

  return (
    <div
      className={`inline-flex items-center justify-center rounded-lg font-bold text-white shrink-0 ${sizes[size]} ${className}`}
      style={{ backgroundColor: color }}
      title={name}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
