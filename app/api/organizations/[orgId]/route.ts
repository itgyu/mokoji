/**
 * Organizations API Routes - Single Organization
 *
 * GET /api/organizations/[orgId] - Fetch organization by ID
 * PUT /api/organizations/[orgId] - Update organization
 * DELETE /api/organizations/[orgId] - Delete organization
 */

import { NextRequest } from 'next/server';
import { organizationsDB } from '@/lib/dynamodb-server';
import {
  withAuth,
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '@/lib/api-auth';

interface RouteContext {
  params: Promise<{
    orgId: string;
  }>;
}

/**
 * GET /api/organizations/[orgId]
 * Fetch organization by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    console.log('GET /api/organizations/[orgId] - Start, orgId:', orgId);

    // Authentication
    const user = await withAuth(request);
    console.log('Authenticated user:', user.sub);

    // Fetch organization
    const organization = await organizationsDB.get(orgId);
    if (!organization) {
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Organization fetched successfully:', orgId);
    return successResponse({ organization });
  } catch (error: any) {
    console.error('GET /api/organizations/[orgId] - Error:', error);

    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }

    return serverErrorResponse('Failed to fetch organization', error);
  }
}

/**
 * PUT /api/organizations/[orgId]
 * Update organization (owner/admin only)
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    console.log('PUT /api/organizations/[orgId] - Start, orgId:', orgId);

    // Authentication
    const user = await withAuth(request);
    console.log('Authenticated user:', user.sub);

    // Fetch organization
    const organization = await organizationsDB.get(orgId);
    if (!organization) {
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check permission - only owner can update
    // In a real app, you'd also check if user is admin
    if (organization.ownerUid !== user.sub) {
      console.log('Permission denied: User is not owner');
      return forbiddenResponse('Only the owner can update this organization');
    }

    // Parse request body
    const body = await request.json();
    console.log('Update data:', body);

    // Remove fields that should not be updated
    const { organizationId, ownerUid, createdAt, ...updates } = body;

    // Update organization
    await organizationsDB.update(orgId, updates);
    console.log('Organization updated successfully:', orgId);

    // Fetch updated organization
    const updatedOrganization = await organizationsDB.get(orgId);

    return successResponse({ organization: updatedOrganization });
  } catch (error: any) {
    console.error('PUT /api/organizations/[orgId] - Error:', error);

    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }

    return serverErrorResponse('Failed to update organization', error);
  }
}

/**
 * DELETE /api/organizations/[orgId]
 * Delete organization (owner only)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    console.log('DELETE /api/organizations/[orgId] - Start, orgId:', orgId);

    // Authentication
    const user = await withAuth(request);
    console.log('Authenticated user:', user.sub);

    // Fetch organization
    const organization = await organizationsDB.get(orgId);
    if (!organization) {
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check permission - only owner can delete
    if (organization.ownerUid !== user.sub) {
      console.log('Permission denied: User is not owner');
      return forbiddenResponse('Only the owner can delete this organization');
    }

    // Delete organization
    await organizationsDB.delete(orgId);
    console.log('Organization deleted successfully:', orgId);

    return successResponse({ success: true, message: 'Organization deleted' });
  } catch (error: any) {
    console.error('DELETE /api/organizations/[orgId] - Error:', error);

    if (error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }

    return serverErrorResponse('Failed to delete organization', error);
  }
}
