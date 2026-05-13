export const config = {
  matcher: '/i/:path*',
};

export default function middleware(request: Request) {
  const userAgent = request.headers.get('user-agent') || '';
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    return Response.redirect(
      new URL('/Installa_FLOW.mobileconfig', request.url)
    );
  }
}
