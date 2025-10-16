"use client";

// Client-side only ID generation to avoid hydration mismatches
export function generateClientId(): string {
  if (typeof window === "undefined") {
    // Server-side fallback - this should not be used in production
    return `temp_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Client-side generation with timestamp and random
  return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Counter-based ID generation for consistent server/client rendering
let clientIdCounter = 0;
export function generateConsistentId(): string {
  clientIdCounter += 1;
  return `id_${clientIdCounter}`;
}

