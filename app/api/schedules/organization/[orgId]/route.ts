/**
 * Organization Schedules API Routes
 *
 * GET /api/schedules/organization/[orgId] - Fetch all schedules of an organization
 */

import { NextResponse } from 'next/server';
import { schedulesDB } from '@/lib/dynamodb-server';
import { withAuth, unauthorizedResponse, serverErrorResponse, successResponse } from '@/lib/api-auth';

// Force dynamic rendering (prevent static generation during build)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


interface RouteParams {
  params: {
    orgId: string;
  };
}

/**
 * GET /api/schedules/organization/[orgId]
 * Fetch all schedules of an organization
 * Query params: startDate, endDate (optional)
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    // Authentication
    const user = await withAuth(request);
    console.log('[GET /api/schedules/organization/[orgId]] Authenticated user:', user.sub);

    const { orgId } = await params;
    console.log('[GET /api/schedules/organization/[orgId]] Fetching schedules for organization:', orgId);

    // Parse query parameters from URL
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    console.log('[GET /api/schedules/organization/[orgId]] Query params:', {
      startDate,
      endDate,
    });

    // Fetch schedules from DynamoDB
    const schedules = await schedulesDB.getByOrganization(orgId, startDate, endDate);
    console.log('[GET /api/schedules/organization/[orgId]] Found schedules:', schedules.length);

    return successResponse({ schedules });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    console.error('[GET /api/schedules/organization/[orgId]] Error:', error);
    return serverErrorResponse('Failed to fetch organization schedules', error);
  }
}
