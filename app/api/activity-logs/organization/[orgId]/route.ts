/**
 * Activity Logs API - GET by Organization
 *
 * Fetch activity logs of an organization
 */

import { NextResponse } from 'next/server';
import { activityLogsDB } from '@/lib/dynamodb-server';
import { withAuth, unauthorizedResponse, serverErrorResponse, successResponse } from '@/lib/api-auth';

export async function GET(
  request: Request,
  { params }: { params: { orgId: string } }
) {
  try {
    console.log('[GET /api/activity-logs/organization/[orgId]] Starting activity logs fetch');

    // Authenticate user
    const user = await withAuth(request);
    console.log('[GET /api/activity-logs/organization/[orgId]] Authenticated user:', user.sub);

    const { orgId } = params;

    // Validate orgId
    if (!orgId) {
      console.error('[GET /api/activity-logs/organization/[orgId]] Missing orgId');
      return NextResponse.json(
        { error: 'Missing orgId parameter' },
        { status: 400 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    // Validate limit
    if (isNaN(limit) || limit < 1 || limit > 100) {
      console.error('[GET /api/activity-logs/organization/[orgId]] Invalid limit:', limitParam);
      return NextResponse.json(
        { error: 'Invalid limit parameter. Must be between 1 and 100' },
        { status: 400 }
      );
    }

    // Fetch activity logs from DynamoDB
    console.log('[GET /api/activity-logs/organization/[orgId]] Fetching logs for organization:', orgId, 'with limit:', limit);
    const logs = await activityLogsDB.getByOrganization(orgId, limit);

    console.log('[GET /api/activity-logs/organization/[orgId]] Found', logs.length, 'activity logs');
    return successResponse({ logs, count: logs.length });

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      console.error('[GET /api/activity-logs/organization/[orgId]] Unauthorized request');
      return unauthorizedResponse();
    }

    console.error('[GET /api/activity-logs/organization/[orgId]] Error:', error);
    return serverErrorResponse('Failed to fetch activity logs', error);
  }
}
