import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // API routes のボディサイズ制限を緩和するためのヘッダー設定
  const response = NextResponse.next();

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
