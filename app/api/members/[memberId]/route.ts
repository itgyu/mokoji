/**
 * Member by ID API Route
 *
 * PUT /api/members/[memberId] - Update member (role, status)
 * DELETE /api/members/[memberId] - Delete member (remove from organization)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, unauthorizedResponse, serverErrorResponse, successResponse } from '@/lib/api-auth';
import { membersDB } from '@/lib/dynamodb-server';

// Force dynamic rendering (prevent static generation during build)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


/**
 * PUT /api/members/[memberId]
 * Update member (role, status)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    // Authentication
    const user = await withAuth(request);
    console.log('[PUT /api/members/[memberId]] Authenticated user:', user.sub);

    const { memberId } = await params;
    console.log('[PUT /api/members/[memberId]] memberId:', memberId);

    // Parse request body
    const body = await request.json();
    const { role, status } = body;

    // Validation
    if (!role && !status) {
      return NextResponse.json(
        { error: 'At least one field (role or status) is required' },
        { status: 400 }
      );
    }

    // Check if member exists
    const existingMember = await membersDB.get(memberId);
    if (!existingMember) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Prepare updates
    const updates: any = {};
    if (role) updates.role = role;
    if (status) updates.status = status;

    console.log('[PUT /api/members/[memberId]] Updating member with:', updates);

    // Update member
    await membersDB.update(memberId, updates);

    // Fetch updated member
    const updatedMember = await membersDB.get(memberId);

    console.log('[PUT /api/members/[memberId]] Member updated successfully');

    return successResponse(updatedMember);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    console.error('[PUT /api/members/[memberId]] Error:', error);
    return serverErrorResponse('Failed to update member', error);
  }
}

/**
 * DELETE /api/members/[memberId]
 * Delete member (remove from organization)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    // Authentication
    const user = await withAuth(request);
    console.log('[DELETE /api/members/[memberId]] Authenticated user:', user.sub);

    const { memberId } = await params;
    console.log('[DELETE /api/members/[memberId]] memberId:', memberId);

    // Check if member exists
    const existingMember = await membersDB.get(memberId);
    if (!existingMember) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    console.log('[DELETE /api/members/[memberId]] Deleting member:', memberId);

    // Delete member
    await membersDB.delete(memberId);

    console.log('[DELETE /api/members/[memberId]] Member deleted successfully');

    return successResponse({ success: true, memberId });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    console.error('[DELETE /api/members/[memberId]] Error:', error);
    return serverErrorResponse('Failed to delete member', error);
  }
}
