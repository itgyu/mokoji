/**
 * Photos API - DELETE
 *
 * Delete photo by photoId
 */

import { NextResponse } from 'next/server';
import { photosDB } from '@/lib/dynamodb-server';
import { withAuth, unauthorizedResponse, serverErrorResponse, successResponse } from '@/lib/api-auth';

// Force dynamic rendering (prevent static generation during build)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ photoId: string }> }
) {
  try {
    console.log('[DELETE /api/photos/[photoId]] Starting photo deletion');

    // Authenticate user
    const user = await withAuth(request);
    console.log('[DELETE /api/photos/[photoId]] Authenticated user:', user.sub);

    const { photoId } = await params;

    // Validate photoId
    if (!photoId) {
      console.error('[DELETE /api/photos/[photoId]] Missing photoId');
      return NextResponse.json(
        { error: 'Missing photoId parameter' },
        { status: 400 }
      );
    }

    // Optional: Check if photo exists and user has permission to delete
    const existingPhoto = await photosDB.get(photoId);
    if (!existingPhoto) {
      console.error('[DELETE /api/photos/[photoId]] Photo not found:', photoId);
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      );
    }

    // Delete photo from DynamoDB
    console.log('[DELETE /api/photos/[photoId]] Deleting photo:', photoId);
    await photosDB.delete(photoId);

    console.log('[DELETE /api/photos/[photoId]] Photo deleted successfully');
    return successResponse({ success: true, message: 'Photo deleted successfully' });

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      console.error('[DELETE /api/photos/[photoId]] Unauthorized request');
      return unauthorizedResponse();
    }

    console.error('[DELETE /api/photos/[photoId]] Error:', error);
    return serverErrorResponse('Failed to delete photo', error);
  }
}
