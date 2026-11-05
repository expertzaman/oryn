import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const has = req.cookies.get("oryn_session")?.value;
  const { pathname, search } = req.nextUrl;
  if (!has && (pathname.startsWith("/app") || pathname.startsWith("/onboarding"))) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/onboarding/:path*"] };
