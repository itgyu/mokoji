import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { getIdToken } from './cognito';

// DynamoDB 클라이언트 초기화
const client = new DynamoDBClient({
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || '',
  },
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});

// 테이블 이름
const TABLES = {
  USERS: process.env.NEXT_PUBLIC_DYNAMODB_USERS_TABLE || 'mokoji-users',
  ORGANIZATIONS: process.env.NEXT_PUBLIC_DYNAMODB_ORGANIZATIONS_TABLE || 'mokoji-organizations',
  MEMBERS: process.env.NEXT_PUBLIC_DYNAMODB_MEMBERS_TABLE || 'mokoji-organization-members',
  SCHEDULES: process.env.NEXT_PUBLIC_DYNAMODB_SCHEDULES_TABLE || 'mokoji-schedules',
  ACTIVITY_LOGS: process.env.NEXT_PUBLIC_DYNAMODB_ACTIVITY_LOGS_TABLE || 'mokoji-activity-logs',
  PHOTOS: process.env.NEXT_PUBLIC_DYNAMODB_PHOTOS_TABLE || 'mokoji-photos',
};

/**
 * Users 테이블
 */
export const usersDB = {
  async get(userId: string) {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLES.USERS,
        Key: { userId },
      })
    );
    return result.Item;
  },

  async getByEmail(email: string) {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.USERS,
        IndexName: 'email-index',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email,
        },
      })
    );
    return result.Items?.[0];
  },

  async create(user: any) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.USERS,
        Item: {
          ...user,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      })
    );
  },

  async update(userId: string, updates: any) {
    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.keys(updates).forEach((key) => {
      updateExpression.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = updates[key];
    });

    updateExpression.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = Date.now();

    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.USERS,
        Key: { userId },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
  },
};

/**
 * Organizations 테이블
 */
export const organizationsDB = {
  async get(organizationId: string) {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLES.ORGANIZATIONS,
        Key: { organizationId },
      })
    );
    return result.Item;
  },

  async getByOwner(ownerUid: string) {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.ORGANIZATIONS,
        IndexName: 'ownerUid-index',
        KeyConditionExpression: 'ownerUid = :ownerUid',
        ExpressionAttributeValues: {
          ':ownerUid': ownerUid,
        },
      })
    );
    return result.Items || [];
  },

  async create(organization: any) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.ORGANIZATIONS,
        Item: {
          ...organization,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      })
    );
  },

  async update(organizationId: string, updates: any) {
    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.keys(updates).forEach((key) => {
      updateExpression.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = updates[key];
    });

    updateExpression.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = Date.now();

    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.ORGANIZATIONS,
        Key: { organizationId },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
  },

  async delete(organizationId: string) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.ORGANIZATIONS,
        Key: { organizationId },
      })
    );
  },

  async getAll(limit?: number) {
    const params: any = {
      TableName: TABLES.ORGANIZATIONS,
    };

    if (limit) {
      params.Limit = limit;
    }

    const result = await docClient.send(new ScanCommand(params));
    return result.Items || [];
  },
};

/**
 * OrganizationMembers 테이블
 */
export const membersDB = {
  async get(memberId: string) {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLES.MEMBERS,
        Key: { memberId },
      })
    );
    return result.Item;
  },

  async getByOrganization(organizationId: string) {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.MEMBERS,
        IndexName: 'organizationId-index',
        KeyConditionExpression: 'organizationId = :organizationId',
        ExpressionAttributeValues: {
          ':organizationId': organizationId,
        },
      })
    );
    return result.Items || [];
  },

  async getByUser(userId: string) {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.MEMBERS,
        IndexName: 'userId-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
      })
    );
    return result.Items || [];
  },

  async create(member: any) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.MEMBERS,
        Item: {
          ...member,
          joinedAt: member.joinedAt || Date.now(), // ⚠️ joinedAt 보존
        },
      })
    );
  },

  async update(memberId: string, updates: any) {
    // ⚠️ joinedAt 필드는 업데이트하지 않음
    const { joinedAt, ...safeUpdates } = updates;

    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.keys(safeUpdates).forEach((key) => {
      updateExpression.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = safeUpdates[key];
    });

    if (updateExpression.length === 0) return;

    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.MEMBERS,
        Key: { memberId },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
  },

  async delete(memberId: string) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.MEMBERS,
        Key: { memberId },
      })
    );
  },
};

/**
 * Schedules 테이블
 */
export const schedulesDB = {
  async get(scheduleId: string) {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLES.SCHEDULES,
        Key: { scheduleId },
      })
    );
    return result.Item;
  },

  async getByOrganization(organizationId: string, startDate?: string, endDate?: string) {
    const params: any = {
      TableName: TABLES.SCHEDULES,
      IndexName: 'organizationId-date-index',
      KeyConditionExpression: 'organizationId = :organizationId',
      ExpressionAttributeValues: {
        ':organizationId': organizationId,
      },
    };

    if (startDate && endDate) {
      params.KeyConditionExpression += ' AND #date BETWEEN :startDate AND :endDate';
      params.ExpressionAttributeNames = { '#date': 'date' };
      params.ExpressionAttributeValues[':startDate'] = startDate;
      params.ExpressionAttributeValues[':endDate'] = endDate;
    }

    const result = await docClient.send(new QueryCommand(params));
    return result.Items || [];
  },

  async create(schedule: any) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.SCHEDULES,
        Item: {
          ...schedule,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      })
    );
  },

  async update(scheduleId: string, updates: any) {
    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.keys(updates).forEach((key) => {
      updateExpression.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = updates[key];
    });

    updateExpression.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = Date.now();

    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.SCHEDULES,
        Key: { scheduleId },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
  },

  async delete(scheduleId: string) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.SCHEDULES,
        Key: { scheduleId },
      })
    );
  },
};

/**
 * ActivityLogs 테이블
 */
export const activityLogsDB = {
  async getByOrganization(organizationId: string, limit = 50) {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.ACTIVITY_LOGS,
        IndexName: 'organizationId-timestamp-index',
        KeyConditionExpression: 'organizationId = :organizationId',
        ExpressionAttributeValues: {
          ':organizationId': organizationId,
        },
        ScanIndexForward: false, // 최신순
        Limit: limit,
      })
    );
    return result.Items || [];
  },

  async create(log: any) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.ACTIVITY_LOGS,
        Item: {
          ...log,
          timestamp: log.timestamp || Date.now(),
        },
      })
    );
  },
};

/**
 * Photos 테이블
 */
export const photosDB = {
  async get(photoId: string) {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLES.PHOTOS,
        Key: { photoId },
      })
    );
    return result.Item;
  },

  async getByOrganization(organizationId: string, limit = 50) {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.PHOTOS,
        IndexName: 'organizationId-createdAt-index',
        KeyConditionExpression: 'organizationId = :organizationId',
        ExpressionAttributeValues: {
          ':organizationId': organizationId,
        },
        ScanIndexForward: false, // 최신순
        Limit: limit,
      })
    );
    return result.Items || [];
  },

  async create(photo: any) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.PHOTOS,
        Item: {
          ...photo,
          createdAt: photo.createdAt || Date.now(),
        },
      })
    );
  },

  async delete(photoId: string) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.PHOTOS,
        Key: { photoId },
      })
    );
  },
};

export { docClient, TABLES };
