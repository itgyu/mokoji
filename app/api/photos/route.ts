/**
 * Photos API - POST
 *
 * Create photo metadata after S3 upload
 */

import { NextResponse } from 'next/server';
import { photosDB } from '@/lib/dynamodb-server';
import { withAuth, unauthorizedResponse, serverErrorResponse, successResponse } from '@/lib/api-auth';

export async function POST(request: Request) {
  try {
    console.log('[POST /api/photos] Starting photo creation');

    // Authenticate user
    const user = await withAuth(request);
    console.log('[POST /api/photos] Authenticated user:', user.sub);

    // Parse request body
    const body = await request.json();
    const {
      photoId,
      url,
      organizationId,
      uploaderUid,
      uploaderName,
      caption,
      tags,
      thumbnailUrl,
    } = body;

    // Validate required fields
    if (!photoId || !url || !organizationId || !uploaderUid) {
      console.error('[POST /api/photos] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: photoId, url, organizationId, uploaderUid' },
        { status: 400 }
      );
    }

    // Create photo metadata
    const photoData = {
      photoId,
      url,
      organizationId,
      uploaderUid,
      uploaderName: uploaderName || 'Unknown',
      caption: caption || '',
      tags: tags || [],
      thumbnailUrl: thumbnailUrl || url,
      createdAt: Date.now(),
    };

    console.log('[POST /api/photos] Creating photo:', photoId);
    await photosDB.create(photoData);

    console.log('[POST /api/photos] Photo created successfully');
    return successResponse(photoData, 201);

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      console.error('[POST /api/photos] Unauthorized request');
      return unauthorizedResponse();
    }

    console.error('[POST /api/photos] Error:', error);
    return serverErrorResponse('Failed to create photo', error);
  }
}
