/**
 * Memberships by User API Route
 *
 * GET /api/members/user/[userId] - Fetch all memberships of a user
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, unauthorizedResponse, serverErrorResponse, successResponse } from '@/lib/api-auth';
import { membersDB } from '@/lib/dynamodb-server';

/**
 * GET /api/members/user/[userId]
 * Fetch all memberships of a user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Authentication
    const user = await withAuth(request);
    console.log('[GET /api/members/user/[userId]] Authenticated user:', user.sub);

    const { userId } = params;
    console.log('[GET /api/members/user/[userId]] userId:', userId);

    // Fetch memberships by user
    const memberships = await membersDB.getByUser(userId);

    console.log('[GET /api/members/user/[userId]] Found', memberships.length, 'memberships');

    return successResponse({ memberships });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    console.error('[GET /api/members/user/[userId]] Error:', error);
    return serverErrorResponse('Failed to fetch user memberships', error);
  }
}
