import { NextResponse } from 'next/server';
import { getDeposits } from '@/lib/data';

export const dynamic = 'force-dynamic';

export function GET() {
  const data = getDeposits();
  return NextResponse.json(data);
}
