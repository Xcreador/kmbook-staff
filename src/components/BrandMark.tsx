import Image from "next/image";

interface BrandMarkProps {
  size?: number;
  className?: string;
  priority?: boolean;
}

/** Símbolo oficial de KMBOOK (mismo recurso que KMBOOK Core: /brand/kmbook-mark.png). */
export function BrandMark({ size = 32, className, priority = false }: BrandMarkProps) {
  return (
    <Image
      src="/brand/kmbook-mark.png"
      alt="KMBOOK"
      width={size}
      height={size}
      className={className}
      priority={priority}
    />
  );
}
