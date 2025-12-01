/**
 * Schedule by ID API Routes
 *
 * GET /api/schedules/[scheduleId] - Fetch schedule by ID
 * PUT /api/schedules/[scheduleId] - Update schedule
 * DELETE /api/schedules/[scheduleId] - Delete schedule
 */

import { NextResponse } from 'next/server';
import { schedulesDB } from '@/lib/dynamodb-server';
import { withAuth, unauthorizedResponse, serverErrorResponse, successResponse } from '@/lib/api-auth';

// Force dynamic rendering (prevent static generation during build)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


interface RouteParams {
  params: {
    scheduleId: string;
  };
}

/**
 * GET /api/schedules/[scheduleId]
 * Fetch schedule by ID
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    // Authentication
    const user = await withAuth(request);
    console.log('[GET /api/schedules/[scheduleId]] Authenticated user:', user.sub);

    const { scheduleId } = params;
    console.log('[GET /api/schedules/[scheduleId]] Fetching schedule:', scheduleId);

    // Fetch schedule from DynamoDB
    const schedule = await schedulesDB.get(scheduleId);

    if (!schedule) {
      console.log('[GET /api/schedules/[scheduleId]] Schedule not found:', scheduleId);
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    console.log('[GET /api/schedules/[scheduleId]] Schedule fetched successfully');
    return successResponse({ schedule });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    console.error('[GET /api/schedules/[scheduleId]] Error:', error);
    return serverErrorResponse('Failed to fetch schedule', error);
  }
}

/**
 * PUT /api/schedules/[scheduleId]
 * Update schedule
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    // Authentication
    const user = await withAuth(request);
    console.log('[PUT /api/schedules/[scheduleId]] Authenticated user:', user.sub);

    const { scheduleId } = params;
    console.log('[PUT /api/schedules/[scheduleId]] Updating schedule:', scheduleId);

    // Check if schedule exists
    const existingSchedule = await schedulesDB.get(scheduleId);
    if (!existingSchedule) {
      console.log('[PUT /api/schedules/[scheduleId]] Schedule not found:', scheduleId);
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      title,
      date,
      time,
      location,
      description,
      participants,
      maxParticipants,
    } = body;

    // Build updates object (only include provided fields)
    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (date !== undefined) updates.date = date;
    if (time !== undefined) updates.time = time;
    if (location !== undefined) updates.location = location;
    if (description !== undefined) updates.description = description;
    if (participants !== undefined) updates.participants = participants;
    if (maxParticipants !== undefined) updates.maxParticipants = maxParticipants;

    // Update schedule in DynamoDB
    await schedulesDB.update(scheduleId, updates);
    console.log('[PUT /api/schedules/[scheduleId]] Schedule updated successfully');

    // Fetch updated schedule
    const updatedSchedule = await schedulesDB.get(scheduleId);

    return successResponse({ schedule: updatedSchedule });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    console.error('[PUT /api/schedules/[scheduleId]] Error:', error);
    return serverErrorResponse('Failed to update schedule', error);
  }
}

/**
 * DELETE /api/schedules/[scheduleId]
 * Delete schedule
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    // Authentication
    const user = await withAuth(request);
    console.log('[DELETE /api/schedules/[scheduleId]] Authenticated user:', user.sub);

    const { scheduleId } = params;
    console.log('[DELETE /api/schedules/[scheduleId]] Deleting schedule:', scheduleId);

    // Check if schedule exists
    const existingSchedule = await schedulesDB.get(scheduleId);
    if (!existingSchedule) {
      console.log('[DELETE /api/schedules/[scheduleId]] Schedule not found:', scheduleId);
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    // Delete schedule from DynamoDB
    await schedulesDB.delete(scheduleId);
    console.log('[DELETE /api/schedules/[scheduleId]] Schedule deleted successfully');

    return successResponse({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    console.error('[DELETE /api/schedules/[scheduleId]] Error:', error);
    return serverErrorResponse('Failed to delete schedule', error);
  }
}
