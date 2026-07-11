import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Dashboard requires a signed-in user; the landing page, agent API
// (API-key auth), MCP endpoint, and Stripe webhooks stay public.
const isProtectedRoute = createRouteMatcher(['/dashboard(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Everything except Next internals, static files, and /api routes.
    // API routes (agent API, MCP, Stripe webhooks) do their own auth and
    // must NOT pass through Clerk's edge middleware — the extra hop adds
    // latency that breaks Stripe Issuing's ~2s real-time authorization
    // window, and can alter the response Stripe reads.
    '/((?!_next|api/|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/__clerk/:path*',
  ],
};
