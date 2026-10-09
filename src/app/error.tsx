"use client";

import { BrandScreen } from "@/components/BrandScreen";
import { Button } from "@/components/Button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <BrandScreen
      role="alert"
      title="Algo no ha ido bien"
      message="No hemos podido mostrar esta pantalla. Inténtalo de nuevo."
    >
      <Button variant="accent" size="md" onClick={reset}>
        Reintentar
      </Button>
    </BrandScreen>
  );
}
