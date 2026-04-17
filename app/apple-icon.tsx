import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Home-screen icon aligned with ASB Group VAR navbar (`--bs-navbar` #1d427d).
 * Official mark is `public/branding/var-logo.svg` (browser favicon via `app/icon.svg`).
 */
export default function AppleIcon(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1d427d",
          color: "#ffffff",
          fontSize: 48,
          fontWeight: 700,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          letterSpacing: "-0.04em",
        }}
      >
        VAR
      </div>
    ),
    { ...size },
  );
}
