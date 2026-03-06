import { NextResponse } from 'next/server';
import { getSnapshots } from '@/lib/data';

export const dynamic = 'force-dynamic';

export function GET() {
  const data = getSnapshots();
  return NextResponse.json(data);
}
