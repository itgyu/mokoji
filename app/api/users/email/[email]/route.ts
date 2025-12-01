/**
 * Users API - Fetch User by Email
 *
 * GET /api/users/email/[email] - Fetch user by email
 */

import { NextResponse } from 'next/server';
import { withAuth, successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-auth';
import { usersDB } from '@/lib/dynamodb-server';

// Force dynamic rendering (prevent static generation during build)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


/**
 * GET /api/users/email/[email]
 * Fetch user by email
 */
export async function GET(
  request: Request,
  { params }: { params: { email: string } }
) {
  try {
    console.log('🔍 [GET /api/users/email/:email] Starting request');

    // Verify authentication
    const authUser = await withAuth(request);
    console.log('✅ [GET /api/users/email/:email] Authenticated user:', authUser.sub);

    const { email } = params;
    // Decode email in case it's URL-encoded
    const decodedEmail = decodeURIComponent(email);
    console.log('🔍 [GET /api/users/email/:email] Fetching user with email:', decodedEmail);

    // Fetch user from DynamoDB by email
    const user = await usersDB.getByEmail(decodedEmail);

    if (!user) {
      console.log('❌ [GET /api/users/email/:email] User not found with email:', decodedEmail);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('✅ [GET /api/users/email/:email] User fetched successfully:', user.userId);
    return successResponse(user);

  } catch (error: any) {
    console.error('❌ [GET /api/users/email/:email] Error:', error);

    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }

    return serverErrorResponse('Failed to fetch user by email', error);
  }
}
