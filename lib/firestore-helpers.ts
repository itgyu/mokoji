import { usersAPI, organizationsAPI, membersAPI, schedulesAPI } from './api-client';
import type {
  UserProfile,
  Organization,
  OrganizationMember,
  Event,
  Post,
  Comment,
  Notification,
} from '@/types';

// ============================================
// Generic CRUD Operations (DynamoDB-based)
// ============================================

export async function getDocument<T>(
  collectionName: string,
  docId: string
): Promise<T | null> {
  try {
    let result: any = null;

    switch (collectionName) {
      case 'userProfiles':
      case 'users':
        result = await usersAPI.get(docId);
        if (result) {
          result = { id: result.userId, ...result };
        }
        break;
      case 'organizations':
        result = await organizationsAPI.get(docId);
        if (result) {
          result = { id: result.organizationId, ...result };
        }
        break;
      case 'organizationMembers':
        result = await membersAPI.get(docId);
        if (result) {
          result = { id: result.memberId, ...result };
        }
        break;
      case 'schedules':
      case 'events':
        result = await schedulesAPI.get(docId);
        if (result) {
          result = { id: result.scheduleId, ...result };
        }
        break;
      default:
        console.warn(`⚠️ Unsupported collection: ${collectionName}`);
        return null;
    }

    return result as T | null;
  } catch (error) {
    console.error(`❌ Error getting document from ${collectionName}:`, error);
    return null;
  }
}

export async function getDocuments<T>(
  collectionName: string,
  constraints: any[] = []
): Promise<T[]> {
  try {
    // Note: DynamoDB doesn't support arbitrary queries like Firestore
    // This is a simplified implementation
    console.warn('⚠️ getDocuments with constraints is not fully implemented for DynamoDB');
    return [];
  } catch (error) {
    console.error(`❌ Error getting documents from ${collectionName}:`, error);
    return [];
  }
}

export async function createDocument<T>(
  collectionName: string,
  data: Omit<T, 'id'>
): Promise<string> {
  try {
    const timestamp = Date.now();
    const id = `${collectionName.slice(0, 3)}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    switch (collectionName) {
      case 'userProfiles':
      case 'users':
        await usersAPI.create({
          userId: id,
          ...data,
          createdAt: timestamp,
          updatedAt: timestamp,
        } as any);
        break;
      case 'organizations':
        await organizationsAPI.create({
          organizationId: id,
          ...data,
          createdAt: timestamp,
          updatedAt: timestamp,
        } as any);
        break;
      case 'organizationMembers':
        await membersAPI.create({
          memberId: id,
          ...data,
          joinedAt: timestamp,
        } as any);
        break;
      case 'schedules':
      case 'events':
        await schedulesAPI.create({
          scheduleId: id,
          ...data,
          createdAt: timestamp,
          updatedAt: timestamp,
        } as any);
        break;
      default:
        console.warn(`⚠️ Unsupported collection: ${collectionName}`);
    }

    return id;
  } catch (error) {
    console.error(`❌ Error creating document in ${collectionName}:`, error);
    throw error;
  }
}

export async function updateDocument(
  collectionName: string,
  docId: string,
  data: any
): Promise<void> {
  try {
    const updates = {
      ...data,
      updatedAt: Date.now(),
    };

    switch (collectionName) {
      case 'userProfiles':
      case 'users':
        await usersAPI.update(docId, updates);
        break;
      case 'organizations':
        await organizationsAPI.update(docId, updates);
        break;
      case 'organizationMembers':
        await membersAPI.update(docId, updates);
        break;
      case 'schedules':
      case 'events':
        await schedulesAPI.update(docId, updates);
        break;
      default:
        console.warn(`⚠️ Unsupported collection: ${collectionName}`);
    }
  } catch (error) {
    console.error(`❌ Error updating document in ${collectionName}:`, error);
    throw error;
  }
}

export async function softDeleteDocument(
  collectionName: string,
  docId: string
): Promise<void> {
  try {
    await updateDocument(collectionName, docId, {
      deletedAt: Date.now(),
      isActive: false,
    });
  } catch (error) {
    console.error(`❌ Error soft deleting document in ${collectionName}:`, error);
    throw error;
  }
}

// ============================================
// User Profile Operations
// ============================================

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const user = await usersAPI.get(userId);
    if (!user) return null;

    return {
      uid: user.userId,
      email: user.email,
      name: user.name,
      gender: user.gender,
      birthdate: user.birthdate,
      location: user.location,
      mbti: user.mbti,
      avatar: user.avatar,
      joinDate: user.createdAt ? new Date(user.createdAt).toLocaleDateString('ko-KR') : '',
      interestCategories: user.interestCategories || [],
      organizations: user.organizations || [],
      joinedOrganizations: user.joinedOrganizations || [],
      locations: user.locations || [],
      selectedLocationId: user.selectedLocationId || '',
    } as UserProfile;
  } catch (error) {
    console.error('❌ Error getting user profile:', error);
    return null;
  }
}

export async function updateUserProfile(
  userId: string,
  data: Partial<UserProfile>
): Promise<void> {
  try {
    await usersAPI.update(userId, data);
  } catch (error) {
    console.error('❌ Error updating user profile:', error);
    throw error;
  }
}

// ============================================
// Organization Operations
// ============================================

export async function getOrganization(orgId: string): Promise<Organization | null> {
  try {
    const org = await organizationsAPI.get(orgId);
    if (!org) return null;

    return {
      id: org.organizationId,
      ...org,
    } as Organization;
  } catch (error) {
    console.error('❌ Error getting organization:', error);
    return null;
  }
}

export async function getOrganizations(
  constraints: any[] = []
): Promise<Organization[]> {
  try {
    // DynamoDB doesn't support arbitrary queries
    // This would need to be implemented based on specific use cases
    console.warn('⚠️ getOrganizations with constraints is not fully implemented');
    return [];
  } catch (error) {
    console.error('❌ Error getting organizations:', error);
    return [];
  }
}

export async function createOrganization(
  data: Omit<Organization, 'id'>
): Promise<string> {
  try {
    const timestamp = Date.now();
    const orgId = `org_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    await organizationsAPI.create({
      organizationId: orgId,
      ...data,
      createdAt: timestamp,
      updatedAt: timestamp,
    } as any);

    return orgId;
  } catch (error) {
    console.error('❌ Error creating organization:', error);
    throw error;
  }
}

export async function updateOrganization(
  orgId: string,
  data: Partial<Organization>
): Promise<void> {
  try {
    await organizationsAPI.update(orgId, data);
  } catch (error) {
    console.error('❌ Error updating organization:', error);
    throw error;
  }
}

// ============================================
// Organization Member Operations
// ============================================

export async function getOrganizationMembers(
  orgId: string
): Promise<OrganizationMember[]> {
  console.log('🔍 [getOrganizationMembers] 조회 시작 - orgId:', orgId);

  try {
    const response = await membersAPI.getByOrganization(orgId);
    // API returns {members: [...]} format
    const members = response?.members || response || [];

    // active 상태만 필터링 & 정렬
    const activeMembers = (Array.isArray(members) ? members : [])
      .filter((m: any) => m.status === 'active')
      .sort((a: any, b: any) => {
        const aTime = a.joinedAt || 0;
        const bTime = b.joinedAt || 0;
        return bTime - aTime; // 최신순
      })
      .map((m: any) => ({
        id: m.memberId,
        userId: m.userId,
        organizationId: m.organizationId,
        role: m.role || 'member',
        permissions: m.permissions || [],
        status: m.status || 'active',
        stats: m.stats || {
          eventsAttended: 0,
          postsCreated: 0,
          lastActivityAt: { seconds: Math.floor(Date.now() / 1000) },
        },
        joinedAt: m.joinedAt ? { seconds: Math.floor(m.joinedAt / 1000) } : null,
        organizationId_userId: m.organizationId_userId || `${m.organizationId}_${m.userId}`,
      })) as OrganizationMember[];

    console.log('✅ [getOrganizationMembers] active:', activeMembers.length, '개');
    return activeMembers;
  } catch (error) {
    console.error('❌ Error getting organization members:', error);
    return [];
  }
}

export async function getUserMemberships(
  userId: string
): Promise<OrganizationMember[]> {
  console.log('🔍 [getUserMemberships] 조회 시작 - userId:', userId);

  try {
    const members = await membersAPI.getByUser(userId);

    // active 상태만 필터링
    const activeMembers = members
      .filter((m: any) => m.status === 'active')
      .map((m: any) => ({
        id: m.memberId,
        userId: m.userId,
        organizationId: m.organizationId,
        role: m.role || 'member',
        permissions: m.permissions || [],
        status: m.status || 'active',
        stats: m.stats || {
          eventsAttended: 0,
          postsCreated: 0,
          lastActivityAt: { seconds: Math.floor(Date.now() / 1000) },
        },
        joinedAt: m.joinedAt ? { seconds: Math.floor(m.joinedAt / 1000) } : null,
        organizationId_userId: m.organizationId_userId || `${m.organizationId}_${m.userId}`,
      })) as OrganizationMember[];

    console.log('✅ [getUserMemberships] active:', activeMembers.length, '개');
    return activeMembers;
  } catch (error) {
    console.error('❌ Error getting user memberships:', error);
    return [];
  }
}

export async function addOrganizationMember(
  orgId: string,
  userId: string,
  role: 'owner' | 'admin' | 'member' = 'member'
): Promise<string> {
  try {
    const timestamp = Date.now();
    const memberId = `mem_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

    const memberData = {
      memberId,
      organizationId: orgId,
      userId: userId,
      role: role,
      permissions: [],
      status: 'active',
      stats: {
        eventsAttended: 0,
        postsCreated: 0,
        lastActivityAt: timestamp,
      },
      joinedAt: timestamp,
      organizationId_userId: `${orgId}_${userId}`,
    };

    await membersAPI.create(memberData);
    return memberId;
  } catch (error) {
    console.error('❌ Error adding organization member:', error);
    throw error;
  }
}

// ============================================
// Event Operations
// ============================================

export async function getOrganizationEvents(
  orgId: string,
  statusFilter?: 'scheduled' | 'ongoing' | 'completed'
): Promise<Event[]> {
  try {
    // Get all schedules for the organization
    const schedules = await schedulesAPI.getByOrganization(orgId);

    // Filter by status if provided
    let filtered = schedules;
    if (statusFilter) {
      filtered = schedules.filter((s: any) => s.status === statusFilter);
    }

    // Sort by start date
    filtered.sort((a: any, b: any) => {
      const aDate = a.date || a.startDate || 0;
      const bDate = b.date || b.startDate || 0;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });

    return filtered.map((s: any) => ({
      id: s.scheduleId,
      ...s,
    })) as Event[];
  } catch (error) {
    console.error('❌ Error getting organization events:', error);
    return [];
  }
}

// ============================================
// Search Operations
// ============================================

export async function searchOrganizationsByLocation(
  latitude: number,
  longitude: number,
  radiusKm: number = 10
): Promise<Organization[]> {
  try {
    // DynamoDB doesn't support native geo queries
    // This would need to be implemented using a geo-hashing library or ElasticSearch
    console.warn('⚠️ searchOrganizationsByLocation is not implemented for DynamoDB');
    return [];
  } catch (error) {
    console.error('❌ Error searching organizations by location:', error);
    return [];
  }
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}
