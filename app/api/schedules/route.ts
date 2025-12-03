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
      orgId,  // Alternative field name used by client
      description,
      participants,
      maxParticipants,
      type,
      createdBy,
      createdByUid,
    } = body;

    // Support both organizationId and orgId (client uses orgId)
    const resolvedOrgId = organizationId || orgId;

    // Validate required fields
    if (!title || !date || !resolvedOrgId) {
      console.log('[POST /api/schedules] Missing required fields:', { title: !!title, date: !!date, organizationId: !!resolvedOrgId });
      return NextResponse.json(
        { error: 'Missing required fields: title, date, organizationId' },
        { status: 400 }
      );
    }

    // Generate scheduleId
    const scheduleId = crypto.randomUUID();
    console.log('[POST /api/schedules] Generated scheduleId:', scheduleId);

    // Parse dateISO from body or generate from date
    let dateISO = body.dateISO;
    if (!dateISO && date) {
      // Try to parse date in various formats (e.g., "12/20(토)" or "2025-12-20")
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        dateISO = date;
      } else {
        // Try to extract date from format like "12/20(토)"
        const match = date.match(/(\d{1,2})\/(\d{1,2})/);
        if (match) {
          const month = match[1].padStart(2, '0');
          const day = match[2].padStart(2, '0');
          const year = new Date().getFullYear();
          // If the month is less than current month, assume next year
          const currentMonth = new Date().getMonth() + 1;
          const targetYear = parseInt(month) < currentMonth ? year + 1 : year;
          dateISO = `${targetYear}-${month}-${day}`;
        }
      }
    }

    // Create schedule object
    const schedule = {
      scheduleId,
      title,
      date,
      dateISO: dateISO || null,
      time: time || null,
      location: location || null,
      organizationId: resolvedOrgId,
      type: type || null,
      description: description || null,
      participants: participants || [],
      maxParticipants: maxParticipants || null,
      createdBy: createdBy || user.sub,
      createdByUid: createdByUid || user.sub,
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
