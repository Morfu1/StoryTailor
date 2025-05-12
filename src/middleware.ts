import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const AUTH_COOKIE_NAME = 'firebaseIdToken'; // Adjust if you use a different cookie name for session management

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicPaths = ['/login', '/signup'];
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  
  // This is a simplified check. In a real app with Firebase,
  // you'd typically verify a session cookie or token.
  // For client-side Firebase Auth, the client handles redirects after checking auth state.
  // This middleware is more for server-rendered pages or API routes if not using client-side auth checks.
  // For Next.js App Router with client components, the check often happens in a layout or page.
  
  // Let's assume for now that if a user tries to access /app/* routes without being "authenticated"
  // (which we can't fully check here without a session cookie), they should be redirected.
  // The actual auth state check will happen client-side via AuthProvider.

  const currentUser = request.cookies.get(AUTH_COOKIE_NAME)?.value; // Example, adjust based on your auth setup

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.')) {
    // Allow static files, API routes, etc.
    return NextResponse.next();
  }

  if (pathname.startsWith('/app') && !currentUser && !isPublicPath) {
    // If trying to access an app route and no auth token (simplistic check)
    // This redirect might be too aggressive if relying purely on client-side Firebase Auth.
    // Better to handle in client components for initial load.
    // However, if direct navigation to an app page occurs, this can help.
    // For a robust solution, Firebase session cookies would be used.
    // For now, let's remove server-side redirect from middleware to rely on client-side checks.
    // return NextResponse.redirect(new URL('/login', request.url));
  }

  if ((pathname === '/login' || pathname === '/signup') && currentUser) {
    // If on login/signup page and authenticated (simplistic check)
    // return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  // The root page redirection logic
  if (pathname === '/') {
    if (currentUser) { // Simplistic check, same caveats apply
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } else {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - assets (any asset folders)
     */
    // '/((?!api|_next/static|_next/image|favicon.ico|assets).*)',
    '/', // Apply to root for redirection
    '/app/:path*', // Apply to app routes for potential future server-side protection
    '/login', // Apply to login for redirection if authenticated
    '/signup', // Apply to signup for redirection if authenticated
  ],
};
