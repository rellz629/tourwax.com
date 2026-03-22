import { NextResponse } from 'next/server';
import { db } from '@/db';
import { artists } from '@/db/schema';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();

  try {
    // Test database connection
    const result = await db.select({
      count: sql<number>`count(*)`
    }).from(artists);

    const duration = Date.now() - startTime;

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      artistCount: result[0].count,
      responseTime: `${duration}ms`,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;

    return NextResponse.json({
      status: 'error',
      database: 'disconnected',
      responseTime: `${duration}ms`,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
