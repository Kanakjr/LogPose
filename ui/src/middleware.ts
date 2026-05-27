import { NextRequest, NextResponse } from "next/server";

/**
 * Inject X-LOGPOSE-KEY (and X-LOGPOSE-CREW-KEY for the crew service) on every
 * /api/game/* and /api/crew/* request server-side. Browser never sees secrets.
 * Paired with next.config.ts rewrites that forward to the Docker DNS names.
 */
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (!path.startsWith("/api/")) {
    return NextResponse.next();
  }

  const headers = new Headers(req.headers);
  const gameKey = process.env.LOGPOSE_API_KEY ?? "";
  const crewKey = process.env.LOGPOSE_CREW_KEY ?? gameKey;

  if (path.startsWith("/api/game/") && gameKey) {
    headers.set("x-logpose-key", gameKey);
  }
  if (path.startsWith("/api/crew/") && crewKey) {
    headers.set("x-logpose-crew-key", crewKey);
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: "/api/:path*",
};
