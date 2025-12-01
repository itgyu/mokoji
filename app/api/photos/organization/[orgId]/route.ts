/**
 * Photos API - GET by Organization
 *
 * Fetch photos of an organization
 */

import { NextResponse } from 'next/server';
import { photosDB } from '@/lib/dynamodb-server';
import { withAuth, unauthorizedResponse, serverErrorResponse, successResponse } from '@/lib/api-auth';

// Force dynamic rendering (prevent static generation during build)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function GET(
  request: Request,
  { params }: { params: { orgId: string } }
) {
  try {
    console.log('[GET /api/photos/organization/[orgId]] Starting photo fetch');

    // Authenticate user
    const user = await withAuth(request);
    console.log('[GET /api/photos/organization/[orgId]] Authenticated user:', user.sub);

    const { orgId } = params;

    // Validate orgId
    if (!orgId) {
      console.error('[GET /api/photos/organization/[orgId]] Missing orgId');
      return NextResponse.json(
        { error: 'Missing orgId parameter' },
        { status: 400 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    // Validate limit
    if (isNaN(limit) || limit < 1 || limit > 100) {
      console.error('[GET /api/photos/organization/[orgId]] Invalid limit:', limitParam);
      return NextResponse.json(
        { error: 'Invalid limit parameter. Must be between 1 and 100' },
        { status: 400 }
      );
    }

    // Fetch photos from DynamoDB
    console.log('[GET /api/photos/organization/[orgId]] Fetching photos for organization:', orgId, 'with limit:', limit);
    const photos = await photosDB.getByOrganization(orgId, limit);

    console.log('[GET /api/photos/organization/[orgId]] Found', photos.length, 'photos');
    return successResponse({ photos, count: photos.length });

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      console.error('[GET /api/photos/organization/[orgId]] Unauthorized request');
      return unauthorizedResponse();
    }

    console.error('[GET /api/photos/organization/[orgId]] Error:', error);
    return serverErrorResponse('Failed to fetch photos', error);
  }
}
