/**
 * Activity Logs API - POST
 *
 * Create activity log
 */

import { NextResponse } from 'next/server';
import { activityLogsDB } from '@/lib/dynamodb-server';
import { withAuth, unauthorizedResponse, serverErrorResponse, successResponse } from '@/lib/api-auth';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  try {
    console.log('[POST /api/activity-logs] Starting activity log creation');

    // Authenticate user
    const user = await withAuth(request);
    console.log('[POST /api/activity-logs] Authenticated user:', user.sub);

    // Parse request body
    const body = await request.json();
    const {
      organizationId,
      action,
      userName,
      userProfileImage,
      details,
      metadata,
    } = body;

    // Validate required fields
    if (!organizationId || !action || !userName) {
      console.error('[POST /api/activity-logs] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: organizationId, action, userName' },
        { status: 400 }
      );
    }

    // Generate unique logId
    const logId = randomUUID();

    // Create activity log data
    const logData = {
      logId,
      organizationId,
      action,
      userName,
      userProfileImage: userProfileImage || '',
      details: details || '',
      metadata: metadata || {},
      timestamp: Date.now(),
    };

    console.log('[POST /api/activity-logs] Creating activity log:', logId);
    await activityLogsDB.create(logData);

    console.log('[POST /api/activity-logs] Activity log created successfully');
    return successResponse(logData, 201);

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      console.error('[POST /api/activity-logs] Unauthorized request');
      return unauthorizedResponse();
    }

    console.error('[POST /api/activity-logs] Error:', error);
    return serverErrorResponse('Failed to create activity log', error);
  }
}
