/**
 * Organizations API Routes
 *
 * GET /api/organizations - Fetch all organizations
 * POST /api/organizations - Create new organization
 */

import { NextRequest } from 'next/server';
import { organizationsDB } from '@/lib/dynamodb-server';
import {
  withAuth,
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/api-auth';
import { randomUUID } from 'crypto';

// Force dynamic rendering (prevent static generation during build)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


/**
 * GET /api/organizations
 * Fetch all organizations (with limit)
 */
export async function GET(request: NextRequest) {
  try {
    console.log('GET /api/organizations - Start');

    // Authentication
    const user = await withAuth(request);
    console.log('Authenticated user:', user.sub);

    // Fetch all organizations
    const organizations = await organizationsDB.getAll(100);
    console.log(`Fetched ${organizations.length} organizations`);

    return successResponse({ organizations });
  } catch (error: any) {
    console.error('GET /api/organizations - Error:', error);

    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }

    return serverErrorResponse('Failed to fetch organizations', error);
  }
}

/**
 * POST /api/organizations
 * Create new organization
 */
export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/organizations - Start');

    // Authentication
    const user = await withAuth(request);
    console.log('Authenticated user:', user.sub);

    // Parse request body
    const body = await request.json();
    console.log('Request body:', body);

    // Validate required fields
    const { name, description, categories, ownerUid } = body;
    if (!name || !ownerUid) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: name, ownerUid' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate organization ID
    const organizationId = randomUUID();
    console.log('Generated organizationId:', organizationId);

    // Create organization object
    const organization = {
      organizationId,
      name,
      description: description || '',
      categories: categories || [],
      ownerUid,
      memberCount: 1, // Owner is the first member
      photoUrl: body.photoUrl || '',
      location: body.location || '',
      tags: body.tags || [],
      status: 'active',
    };

    // Save to DynamoDB
    await organizationsDB.create(organization);
    console.log('Organization created successfully:', organizationId);

    return successResponse({ organization }, 201);
  } catch (error: any) {
    console.error('POST /api/organizations - Error:', error);

    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }

    return serverErrorResponse('Failed to create organization', error);
  }
}
