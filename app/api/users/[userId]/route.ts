/**
 * Users API - Individual User Operations
 *
 * GET /api/users/[userId] - Fetch user by userId
 * PUT /api/users/[userId] - Update user profile (only allow user to update their own profile)
 */

import { NextResponse } from 'next/server';
import { withAuth, successResponse, unauthorizedResponse, forbiddenResponse, serverErrorResponse } from '@/lib/api-auth';
import { usersDB } from '@/lib/dynamodb-server';

/**
 * GET /api/users/[userId]
 * Fetch user by userId
 */
export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    console.log('🔍 [GET /api/users/:userId] Starting request');

    // Verify authentication
    const authUser = await withAuth(request);
    console.log('✅ [GET /api/users/:userId] Authenticated user:', authUser.sub);

    const { userId } = params;
    console.log('🔍 [GET /api/users/:userId] Fetching user:', userId);

    // Fetch user from DynamoDB
    const user = await usersDB.get(userId);

    if (!user) {
      console.log('❌ [GET /api/users/:userId] User not found:', userId);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('✅ [GET /api/users/:userId] User fetched successfully:', userId);
    return successResponse(user);

  } catch (error: any) {
    console.error('❌ [GET /api/users/:userId] Error:', error);

    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }

    return serverErrorResponse('Failed to fetch user', error);
  }
}

/**
 * PUT /api/users/[userId]
 * Update user profile (only allow user to update their own profile)
 */
export async function PUT(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    console.log('🔄 [PUT /api/users/:userId] Starting request');

    // Verify authentication
    const authUser = await withAuth(request);
    console.log('✅ [PUT /api/users/:userId] Authenticated user:', authUser.sub);

    const { userId } = params;
    console.log('🔄 [PUT /api/users/:userId] Updating user:', userId);

    // Authorization check: User can only update their own profile
    if (authUser.sub !== userId) {
      console.log('❌ [PUT /api/users/:userId] Forbidden: User trying to update another user\'s profile');
      return forbiddenResponse('You can only update your own profile');
    }

    // Parse request body
    const updates = await request.json();
    console.log('📝 [PUT /api/users/:userId] Updates:', Object.keys(updates));

    // Prevent updating certain protected fields
    const protectedFields = ['userId', 'createdAt', 'updatedAt'];
    protectedFields.forEach(field => {
      if (updates[field]) {
        delete updates[field];
        console.log('⚠️  [PUT /api/users/:userId] Removed protected field:', field);
      }
    });

    // Update user in DynamoDB
    await usersDB.update(userId, updates);

    // Fetch updated user
    const updatedUser = await usersDB.get(userId);

    console.log('✅ [PUT /api/users/:userId] User updated successfully:', userId);
    return successResponse(updatedUser);

  } catch (error: any) {
    console.error('❌ [PUT /api/users/:userId] Error:', error);

    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }

    return serverErrorResponse('Failed to update user', error);
  }
}
