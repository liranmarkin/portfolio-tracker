import { NextResponse } from 'next/server';
import { getTransactions } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = getTransactions();
  return NextResponse.json(data);
}
