import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Reflects whatever logo is CURRENTLY set in StoreSettings (admin's
// Configuration → Store logo), instead of a static file baked in at build
// time — if an admin uploads a new logo, this favicon picks it up on the
// next request with no redeploy needed. Falls back to a plain "S" mark
// only if the API is unreachable or no logo has been uploaded yet, so a
// down API never breaks the tab icon.
export default async function Icon() {
  try {
    const res = await fetch(`${API_URL}/api/v1/settings/branding`, { next: { revalidate: 300 } });
    if (res.ok) {
      const { logoUrl } = await res.json();
      if (logoUrl) {
        const imageRes = await fetch(logoUrl, { next: { revalidate: 300 } });
        if (imageRes.ok) {
          const buffer = await imageRes.arrayBuffer();
          return new Response(buffer, { headers: { "Content-Type": imageRes.headers.get("content-type") ?? "image/jpeg" } });
        }
      }
    }
  } catch {
    // fall through to the placeholder mark below
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1c1410",
          color: "#c9773f",
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        S
      </div>
    ),
    { ...size }
  );
}
