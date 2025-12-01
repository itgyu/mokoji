/**
 * Schedules API Routes
 *
 * POST /api/schedules - Create new schedule
 */

import { NextResponse } from 'next/server';
import { schedulesDB } from '@/lib/dynamodb-server';
import { withAuth, unauthorizedResponse, serverErrorResponse, successResponse } from '@/lib/api-auth';
import crypto from 'crypto';

// Force dynamic rendering (prevent static generation during build)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


/**
 * POST /api/schedules
 * Create new schedule
 */
export async function POST(request: Request) {
  try {
    // Authentication
    const user = await withAuth(request);
    console.log('[POST /api/schedules] Authenticated user:', user.sub);

    // Parse request body
    const body = await request.json();
    const {
      title,
      date,
      time,
      location,
      organizationId,
      description,
      participants,
      maxParticipants,
    } = body;

    // Validate required fields
    if (!title || !date || !organizationId) {
      console.log('[POST /api/schedules] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: title, date, organizationId' },
        { status: 400 }
      );
    }

    // Generate scheduleId
    const scheduleId = crypto.randomUUID();
    console.log('[POST /api/schedules] Generated scheduleId:', scheduleId);

    // Create schedule object
    const schedule = {
      scheduleId,
      title,
      date,
      time: time || null,
      location: location || null,
      organizationId,
      description: description || null,
      participants: participants || [],
      maxParticipants: maxParticipants || null,
      createdBy: user.sub,
    };

    // Save to DynamoDB
    await schedulesDB.create(schedule);
    console.log('[POST /api/schedules] Schedule created successfully:', scheduleId);

    return successResponse({ schedule }, 201);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    console.error('[POST /api/schedules] Error:', error);
    return serverErrorResponse('Failed to create schedule', error);
  }
}
