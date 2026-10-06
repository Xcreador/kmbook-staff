import { ImageResponse } from "next/og";

/** Icono de marca de KMBOOK Staff a cualquier tamaño (cuadrado, en píxeles). */
export function renderBrandIcon(px: number) {
  const glyph = Math.round(px * 0.625);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#070023",
          borderRadius: `${Math.round(px * 0.23)}px`,
        }}
      >
        <svg
          width={glyph}
          height={glyph}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M9 28V15C9 13.5 10.5 12 12 12C14.5 12 18 14.5 20 16.5C22 14.5 25.5 12 28 12C29.5 12 31 13.5 31 15V28C31 28 27.5 25.5 25 25.5C22.5 25.5 20.5 27.5 20 28C19.5 27.5 17.5 25.5 15 25.5C12.5 25.5 9 28 9 28Z"
            fill="#FFFFFF"
          />
          <path
            d="M20 16.5V28M15 25.5C12.5 25.5 9 28 9 28V15C9 13.5 10.5 12 12 12C14.5 12 18 14.5 20 16.5C22 14.5 25.5 12 28 12C29.5 12 31 13.5 31 15V28C31 28 27.5 25.5 25 25.5C22.5 25.5 20.5 27.5 20 28Z"
            stroke="#E6006F"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="20" cy="12.5" r="3" fill="#E6006F" />
        </svg>
      </div>
    ),
    { width: px, height: px },
  );
}
