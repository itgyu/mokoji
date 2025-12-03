/**
 * Organizations API Routes
 *
 * GET /api/organizations - Fetch all organizations
 * POST /api/organizations - Create new organization
 */

import { NextRequest } from 'next/server';
import { organizationsDB, membersDB } from '@/lib/dynamodb-server';
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
    const rawOrganizations = await organizationsDB.getAll(100);
    console.log(`Fetched ${rawOrganizations.length} organizations`);

    // Normalize: add 'id' field and real-time member count
    const organizations = await Promise.all(
      rawOrganizations.map(async (org: any) => {
        const orgId = org.id || org.organizationId;

        // Get actual member count from members table
        let actualMemberCount = org.memberCount || 0;
        try {
          const members = await membersDB.getByOrganization(orgId);
          // Count only active members
          actualMemberCount = members.filter((m: any) => m.status === 'active').length;
        } catch (err) {
          console.warn(`Failed to get member count for ${orgId}:`, err);
        }

        return {
          ...org,
          id: orgId, // ensure 'id' field exists
          memberCount: actualMemberCount, // real-time member count
        };
      })
    );

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
