/**
 * Members API Route
 *
 * POST /api/members - Create new member (add member to organization)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, unauthorizedResponse, serverErrorResponse, successResponse } from '@/lib/api-auth';
import { membersDB } from '@/lib/dynamodb-server';
import { randomUUID } from 'crypto';

/**
 * POST /api/members
 * Create new member (add member to organization)
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication
    const user = await withAuth(request);
    console.log('[POST /api/members] Authenticated user:', user.sub);

    // Parse request body
    const body = await request.json();
    const { userId, organizationId, role, status } = body;

    // Validation
    if (!userId || !organizationId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, organizationId' },
        { status: 400 }
      );
    }

    // Generate memberId
    const memberId = randomUUID();

    // Create member object
    const member = {
      memberId,
      userId,
      organizationId,
      role: role || 'member', // Default role: 'member'
      status: status || 'active', // Default status: 'active'
      joinedAt: Date.now(),
    };

    console.log('[POST /api/members] Creating member:', member);

    // Save to DynamoDB
    await membersDB.create(member);

    console.log('[POST /api/members] Member created successfully:', memberId);

    return successResponse(member, 201);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    console.error('[POST /api/members] Error:', error);
    return serverErrorResponse('Failed to create member', error);
  }
}
