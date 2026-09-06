import { NextResponse, type NextRequest } from "next/server";

const DEMO_SESSION_COOKIE = "relay_demo_session";
const SESSION_PATTERN = /^demo_[a-f0-9-]{36}$/;

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const existing = request.cookies.get(DEMO_SESSION_COOKIE)?.value;
  if (typeof existing !== "string" || !SESSION_PATTERN.test(existing)) {
    response.cookies.set(DEMO_SESSION_COOKIE, `demo_${crypto.randomUUID()}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|docs/screenshots).*)"]
};
