"use client";

import React, { useState } from "react";
import { UserIcon } from "./Icons";

interface AvatarProps {
  src?: string | null;
  name: string;
  size: number;
  className?: string;
  placeholderClassName?: string;
}

/**
 * Avatar del profesional: foto heredada de Business o icono genérico.
 * Si la imagen falla (red, foto retirada) vuelve al genérico sin romper el diseño.
 */
export function Avatar({ src, name, size, className, placeholderClassName }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (src && failedSrc !== src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className={className}
        onError={() => setFailedSrc(src)}
      />
    );
  }
  return (
    <div className={placeholderClassName} title={name} role="img" aria-label={name}>
      <UserIcon size={Math.round(size * 0.5)} color="var(--km-oxford)" />
    </div>
  );
}
