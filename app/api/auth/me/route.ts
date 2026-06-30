import { NextRequest, NextResponse } from 'next/server';
import { getProfileFromRequest } from '@/lib/supabase-route-handler';

export async function GET(request: NextRequest) {
  const profile = await getProfileFromRequest(request);
  return NextResponse.json({ profile });
}
