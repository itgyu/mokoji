import { Timestamp } from 'firebase/firestore';

// ============================================
// 1. User & Profile
// ============================================

export interface User {
  uid: string;
  email: string;
  emailVerified: boolean;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  providerId: string;
  disabled: boolean;
}

export interface UserLocation {
  id: string;
  name: string;
  countryCode: string;
  country: string;
  stateProvince?: string;
  city?: string;
  district?: string;
  address: string;
  latitude: number;
  longitude: number;
  verifiedAt: Timestamp;
  isPrimary: boolean;
}

export interface UserStats {
  totalCrews: number;
  totalEvents: number;
  totalPosts: number;
  joinDate: Timestamp;
}

export interface UserSettings {
  notificationEnabled: boolean;
  emailNotification: boolean;
  pushNotification: boolean;
  locationSharing: boolean;
  profileVisibility: 'public' | 'friends' | 'private';
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  birthdate?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';

  locations: UserLocation[];
  selectedLocationId?: string;

  interestCategories: string[];

  joinedOrganizations: string[];
  ownedOrganizations: string[];

  stats: UserStats;
  settings: UserSettings;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;
  isActive: boolean;
}

// ============================================
// 모꼬지 - 동네 모임 플랫폼
// Organization: 크루/모임
// ============================================

export interface OrganizationLocation {
  countryCode: string;
  country: string;
  stateProvince?: string;
  city?: string;
  district?: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface PendingMember {
  uid: string;
  name: string;
  email: string;
  avatar?: string;
  requestedAt: Timestamp;
  message?: string;
}

export interface OrganizationStats {
  totalEvents: number;
  totalPosts: number;
  totalMembers: number;
  activeMembers: number;
  avgRating?: number;
}

export interface OrganizationSettings {
  isPublic: boolean;
  allowGuestView: boolean;
  requireVerification: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageURL?: string;
  images?: string[];

  ownerId: string;
  ownerInfo: {
    name: string;
    avatar?: string;
  };

  location: OrganizationLocation;
  categories: string[];

  memberCount: number;
  maxMembers?: number;

  joinPolicy: 'open' | 'approval' | 'invite';
  pendingMembers?: PendingMember[];

  stats: OrganizationStats;
  settings: OrganizationSettings;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;
  isActive: boolean;

  searchKeywords: string[];
}

// ============================================
// 3. Organization Member (다대다 관계)
// ============================================

export type MemberRole = 'owner' | 'admin' | 'member';
export type MemberStatus = 'active' | 'suspended' | 'left';

export interface MemberStats {
  eventsAttended: number;
  postsCreated: number;
  lastActivityAt: Timestamp;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;

  role: MemberRole;
  permissions: string[];
  status: MemberStatus;

  stats: MemberStats;

  joinedAt: Timestamp;
  leftAt?: Timestamp;

  organizationId_userId: string;
}

// ============================================
// 4. Event
// ============================================

export interface EventLocation {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export type EventStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled';

export interface Event {
  id: string;
  organizationId: string;
  organizationName: string;

  createdBy: string;
  creatorInfo: {
    name: string;
    avatar?: string;
  };

  title: string;
  description: string;
  imageURL?: string;

  startDate: Timestamp;
  endDate: Timestamp;
  isAllDay: boolean;
  timezone: string;

  location?: EventLocation;

  maxParticipants?: number;
  participants: string[];
  participantCount: number;

  status: EventStatus;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;
}

// ============================================
// 5. Post
// ============================================

export interface Post {
  id: string;
  organizationId: string;
  organizationName: string;

  authorId: string;
  authorInfo: {
    name: string;
    avatar?: string;
  };

  title?: string;
  content: string;
  images?: string[];

  likeCount: number;
  commentCount: number;
  likedBy: string[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;
  isPinned: boolean;
}

// ============================================
// 6. Comment
// ============================================

export interface Comment {
  id: string;
  postId: string;
  organizationId: string;

  authorId: string;
  authorInfo: {
    name: string;
    avatar?: string;
  };

  content: string;
  parentCommentId?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;
}

// ============================================
// 7. Notification
// ============================================

export type NotificationType =
  | 'event_created'
  | 'event_reminder'
  | 'post_created'
  | 'comment_added'
  | 'member_joined'
  | 'member_left'
  | 'role_changed'
  | 'organization_updated';

export type NotificationRelatedType = 'event' | 'post' | 'comment' | 'organization';

export interface Notification {
  id: string;
  userId: string;

  type: NotificationType;
  title: string;
  message: string;

  relatedId?: string;
  relatedType?: NotificationRelatedType;
  organizationId?: string;

  isRead: boolean;
  readAt?: Timestamp;

  createdAt: Timestamp;
}

// ============================================
// 8. Category
// ============================================

export interface CategoryNames {
  ko: string;
  en: string;
  ja?: string;
  zh?: string;
}

export interface Category {
  id: string;
  names: CategoryNames;
  icon: string;
  color: string;
  parentId?: string;
  order: number;
  isActive: boolean;
  createdAt: Timestamp;
}

// ============================================
// 9. Location Master
// ============================================

export type LocationType = 'country' | 'state' | 'city' | 'district';

export interface LocationNames {
  ko?: string;
  en?: string;
  local: string;
}

export interface LocationMaster {
  id: string;
  type: LocationType;
  code: string;
  names: LocationNames;
  latitude: number;
  longitude: number;
  parentId?: string;
  isActive: boolean;
  createdAt: Timestamp;
}
