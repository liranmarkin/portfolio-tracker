import { NextResponse } from 'next/server';
import { getPortfolio } from '@/lib/data';

export const dynamic = 'force-dynamic';

export function GET() {
  const data = getPortfolio();
  return NextResponse.json(data);
}
