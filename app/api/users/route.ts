/**
 * Users API - Create New User
 *
 * POST /api/users - Create new user
 */

import { NextResponse } from 'next/server';
import { withAuth, successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api-auth';
import { usersDB } from '@/lib/dynamodb-server';

// Force dynamic rendering (prevent static generation during build)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


/**
 * POST /api/users
 * Create new user
 */
export async function POST(request: Request) {
  try {
    console.log('➕ [POST /api/users] Starting request');

    // Verify authentication
    const authUser = await withAuth(request);
    console.log('✅ [POST /api/users] Authenticated user:', authUser.sub);

    // Parse request body
    const userData = await request.json();
    console.log('📝 [POST /api/users] Creating user with data:', Object.keys(userData));

    // Validate required fields
    if (!userData.userId) {
      console.log('❌ [POST /api/users] Missing required field: userId');
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!userData.email) {
      console.log('❌ [POST /api/users] Missing required field: email');
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await usersDB.get(userData.userId);
    if (existingUser) {
      console.log('❌ [POST /api/users] User already exists:', userData.userId);
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }

    // Check if email is already in use
    const existingEmailUser = await usersDB.getByEmail(userData.email);
    if (existingEmailUser) {
      console.log('❌ [POST /api/users] Email already in use:', userData.email);
      return NextResponse.json(
        { error: 'Email already in use' },
        { status: 409 }
      );
    }

    // Authorization check: User can only create their own profile
    if (authUser.sub !== userData.userId) {
      console.log('❌ [POST /api/users] Forbidden: User trying to create profile for another user');
      return NextResponse.json(
        { error: 'You can only create your own profile' },
        { status: 403 }
      );
    }

    // Create user in DynamoDB
    await usersDB.create(userData);

    // Fetch created user
    const createdUser = await usersDB.get(userData.userId);

    console.log('✅ [POST /api/users] User created successfully:', userData.userId);
    return successResponse(createdUser, 201);

  } catch (error: any) {
    console.error('❌ [POST /api/users] Error:', error);

    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }

    return serverErrorResponse('Failed to create user', error);
  }
}
