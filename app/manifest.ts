import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VAR Electrochem Labor Tracker",
    short_name: "VAR Labor",
    description: "Labor time tracking platform for VAR Electrochem.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6f9",
    theme_color: "#1d427d",
    icons: [
      {
        src: "/branding/var-logo.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
    ],
  };
}
