import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  DocumentSnapshot,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';
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
// Generic CRUD Operations
// ============================================

export async function getDocument<T>(
  collectionName: string,
  docId: string
): Promise<T | null> {
  const docRef = doc(db, collectionName, docId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return { id: docSnap.id, ...docSnap.data() } as T;
}

export async function getDocuments<T>(
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<T[]> {
  const q = query(collection(db, collectionName), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as T[];
}

export async function createDocument<T>(
  collectionName: string,
  data: Omit<T, 'id'>
): Promise<string> {
  const docRef = doc(collection(db, collectionName));
  await setDoc(docRef, {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function updateDocument(
  collectionName: string,
  docId: string,
  data: any
): Promise<void> {
  const docRef = doc(db, collectionName, docId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

export async function softDeleteDocument(
  collectionName: string,
  docId: string
): Promise<void> {
  const docRef = doc(db, collectionName, docId);
  await updateDoc(docRef, {
    deletedAt: Timestamp.now(),
    isActive: false,
    updatedAt: Timestamp.now(),
  });
}

// ============================================
// User Profile Operations
// ============================================

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  return getDocument<UserProfile>('userProfiles', userId);
}

export async function updateUserProfile(
  userId: string,
  data: Partial<UserProfile>
): Promise<void> {
  return updateDocument('userProfiles', userId, data);
}

// ============================================
// Organization Operations
// ============================================

export async function getOrganization(orgId: string): Promise<Organization | null> {
  return getDocument<Organization>('organizations', orgId);
}

export async function getOrganizations(
  constraints: QueryConstraint[] = []
): Promise<Organization[]> {
  return getDocuments<Organization>('organizations', [
    where('isActive', '==', true),
    ...constraints,
  ]);
}

export async function createOrganization(
  data: Omit<Organization, 'id'>
): Promise<string> {
  return createDocument<Organization>('organizations', data);
}

export async function updateOrganization(
  orgId: string,
  data: Partial<Organization>
): Promise<void> {
  return updateDocument('organizations', orgId, data);
}

// ============================================
// Organization Member Operations
// ============================================

export async function getOrganizationMembers(
  orgId: string
): Promise<OrganizationMember[]> {
  return getDocuments<OrganizationMember>('organizationMembers', [
    where('organizationId', '==', orgId),
    where('status', '==', 'active'),
    orderBy('joinedAt', 'desc'),
  ]);
}

export async function getUserMemberships(
  userId: string
): Promise<OrganizationMember[]> {
  console.log('🔍 [getUserMemberships] 조회 시작 - userId:', userId);

  // status 필터 제거하고 메모리에서 필터링 (인덱스 불필요)
  const result = await getDocuments<OrganizationMember>('organizationMembers', [
    where('userId', '==', userId),
  ]);

  // 메모리에서 active 상태만 필터링
  const activeMembers = result.filter(m => m.status === 'active');

  console.log('✅ [getUserMemberships] 전체:', result.length, '개, active:', activeMembers.length, '개');
  return activeMembers;
}

export async function addOrganizationMember(
  orgId: string,
  userId: string,
  role: 'owner' | 'admin' | 'member' = 'member'
): Promise<string> {
  const memberData: Omit<OrganizationMember, 'id'> = {
    organizationId: orgId,
    userId: userId,
    role: role,
    permissions: [],
    status: 'active',
    stats: {
      eventsAttended: 0,
      postsCreated: 0,
      lastActivityAt: Timestamp.now(),
    },
    joinedAt: Timestamp.now(),
    organizationId_userId: `${orgId}_${userId}`,
  };

  return createDocument<OrganizationMember>('organizationMembers', memberData);
}

// ============================================
// Event Operations
// ============================================

export async function getOrganizationEvents(
  orgId: string,
  statusFilter?: 'scheduled' | 'ongoing' | 'completed'
): Promise<Event[]> {
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', orgId),
  ];

  if (statusFilter) {
    constraints.push(where('status', '==', statusFilter));
  }

  constraints.push(orderBy('startDate', 'asc'));

  return getDocuments<Event>('events', constraints);
}

// ============================================
// Search Operations
// ============================================

export async function searchOrganizationsByLocation(
  latitude: number,
  longitude: number,
  radiusKm: number = 10
): Promise<Organization[]> {
  // Note: Firestore doesn't support native geo queries
  // You'll need to use a library like geofirestore or implement bounding box query

  // Simplified version: get all orgs and filter in memory
  const allOrgs = await getOrganizations();

  return allOrgs.filter(org => {
    const distance = calculateDistance(
      latitude,
      longitude,
      org.location.latitude,
      org.location.longitude
    );
    return distance <= radiusKm;
  });
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
