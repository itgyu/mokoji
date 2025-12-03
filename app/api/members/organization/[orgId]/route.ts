/**
 * Members by Organization API Route
 *
 * GET /api/members/organization/[orgId] - Fetch all members of an organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, unauthorizedResponse, serverErrorResponse, successResponse } from '@/lib/api-auth';
import { membersDB } from '@/lib/dynamodb-server';

// Force dynamic rendering (prevent static generation during build)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


/**
 * GET /api/members/organization/[orgId]
 * Fetch all members of an organization
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    // Authentication
    const user = await withAuth(request);
    console.log('[GET /api/members/organization/[orgId]] Authenticated user:', user.sub);

    const { orgId } = await params;
    console.log('[GET /api/members/organization/[orgId]] organizationId:', orgId);

    // Fetch members by organization
    const members = await membersDB.getByOrganization(orgId);

    console.log('[GET /api/members/organization/[orgId]] Found', members.length, 'members');

    return successResponse({ members });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    console.error('[GET /api/members/organization/[orgId]] Error:', error);
    return serverErrorResponse('Failed to fetch organization members', error);
  }
}
