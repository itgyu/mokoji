/**
 * Organizations API Routes - By Owner
 *
 * GET /api/organizations/owner/[ownerUid] - Fetch organizations by owner UID
 */

import { NextRequest } from 'next/server';
import { organizationsDB } from '@/lib/dynamodb-server';
import {
  withAuth,
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/api-auth';

// Force dynamic rendering (prevent static generation during build)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


interface RouteContext {
  params: Promise<{
    ownerUid: string;
  }>;
}

/**
 * GET /api/organizations/owner/[ownerUid]
 * Fetch organizations by owner UID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { ownerUid } = await context.params;
    console.log('GET /api/organizations/owner/[ownerUid] - Start, ownerUid:', ownerUid);

    // Authentication
    const user = await withAuth(request);
    console.log('Authenticated user:', user.sub);

    // Fetch organizations by owner
    const organizations = await organizationsDB.getByOwner(ownerUid);
    console.log(`Fetched ${organizations.length} organizations for owner:`, ownerUid);

    return successResponse({ organizations });
  } catch (error: any) {
    console.error('GET /api/organizations/owner/[ownerUid] - Error:', error);

    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }

    return serverErrorResponse('Failed to fetch organizations by owner', error);
  }
}
