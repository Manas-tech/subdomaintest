import { type NextRequest, NextResponse } from 'next/server';

function getRootDomain(hostname: string): string {
  // Local development
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return 'localhost:3000';
  }

  // Vercel preview deployments (tenant---branch-name.vercel.app)
  if (hostname.includes('---') && hostname.endsWith('.vercel.app')) {
    const parts = hostname.split('---');
    return parts.length > 1 ? parts[parts.length - 1] : hostname;
  }

  // Vercel production domain (subdomaintesttrial.vercel.app)
  if (hostname.endsWith('.vercel.app') && !hostname.includes('---')) {
    return hostname;
  }

  // Custom domain (coffeenchat.me)
  if (hostname.endsWith('.coffeenchat.me')) {
    return 'coffeenchat.me';
  }

  // Fallback: try to detect root domain from environment variable
  const envRootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (envRootDomain) {
    return envRootDomain.split(':')[0];
  }

  // Default fallback
  return hostname;
}

function extractSubdomain(request: NextRequest): string | null {
  const url = request.url;
  const host = request.headers.get('host') || '';
  const hostname = host.split(':')[0];

  // Local development environment
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    // Try to extract subdomain from the full URL
    const fullUrlMatch = url.match(/http:\/\/([^.]+)\.localhost/);
    if (fullUrlMatch && fullUrlMatch[1]) {
      return fullUrlMatch[1];
    }

    // Fallback to host header approach
    if (hostname.includes('.localhost')) {
      return hostname.split('.')[0];
    }

    return null;
  }

  // Get root domain dynamically
  const rootDomainFormatted = getRootDomain(hostname);

  // Handle preview deployment URLs (tenant---branch-name.vercel.app)
  if (hostname.includes('---') && hostname.endsWith('.vercel.app')) {
    const parts = hostname.split('---');
    return parts.length > 0 ? parts[0] : null;
  }

  // Regular subdomain detection for custom domain
  if (hostname.endsWith('.coffeenchat.me')) {
    // Check if it's the root domain itself
    if (hostname === 'coffeenchat.me' || hostname === 'www.coffeenchat.me') {
      return null;
    }
    const subdomain = hostname.replace('.coffeenchat.me', '');
    if (subdomain && subdomain !== 'www') {
      return subdomain;
    }
  }

  // Regular subdomain detection for other domains
  const isSubdomain =
    hostname !== rootDomainFormatted &&
    hostname !== `www.${rootDomainFormatted}` &&
    hostname.endsWith(`.${rootDomainFormatted}`);

  return isSubdomain ? hostname.replace(`.${rootDomainFormatted}`, '') : null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const subdomain = extractSubdomain(request);

  if (subdomain) {
    // Block access to admin page from subdomains
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // For the root path on a subdomain, rewrite to the subdomain page
    if (pathname === '/') {
      return NextResponse.rewrite(new URL(`/s/${subdomain}`, request.url));
    }
  }

  // On the root domain, allow normal access
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api routes
     * 2. /_next (Next.js internals)
     * 3. all root files inside /public (e.g. /favicon.ico)
     */
    '/((?!api|_next|[\\w-]+\\.\\w+).*)'
  ]
};
