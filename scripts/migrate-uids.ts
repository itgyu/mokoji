/**
 * Firebase UID → Cognito sub 마이그레이션 스크립트
 *
 * itgyu@kakao.com 사용자의 UID를 업데이트합니다:
 * - Firebase UID: Ng2AroWF0BgRDP6nrR1WXqf4ImA3
 * - Cognito sub: b468fd2c-c081-705c-4fdd-1f1ccfd445d2
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const docClient = DynamoDBDocumentClient.from(client);

const FIREBASE_UID = 'Ng2AroWF0BgRDP6nrR1WXqf4ImA3';
const COGNITO_SUB = 'b468fd2c-c081-705c-4fdd-1f1ccfd445d2';

async function migrateUIDs() {
  console.log('🔄 Starting UID migration...');
  console.log(`📝 Firebase UID: ${FIREBASE_UID}`);
  console.log(`📝 Cognito sub: ${COGNITO_SUB}`);

  // 1. Update organization-members table
  console.log('\n1️⃣ Updating organization-members table...');
  try {
    const membersResult = await docClient.send(
      new QueryCommand({
        TableName: 'mokoji-organization-members',
        IndexName: 'userId-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': FIREBASE_UID,
        },
      })
    );

    if (membersResult.Items && membersResult.Items.length > 0) {
      for (const member of membersResult.Items) {
        console.log(`   Updating member: ${member.memberId}`);
        await docClient.send(
          new UpdateCommand({
            TableName: 'mokoji-organization-members',
            Key: { memberId: member.memberId },
            UpdateExpression: 'SET userId = :newUserId',
            ExpressionAttributeValues: {
              ':newUserId': COGNITO_SUB,
            },
          })
        );
        console.log(`   ✅ Updated member: ${member.memberId}`);
      }
    } else {
      console.log('   ⚠️ No members found');
    }
  } catch (error) {
    console.error('   ❌ Error updating members:', error);
  }

  // 2. Update organizations table (ownerUid)
  console.log('\n2️⃣ Updating organizations table...');
  try {
    const orgsResult = await docClient.send(
      new QueryCommand({
        TableName: 'mokoji-organizations',
        IndexName: 'ownerUid-index',
        KeyConditionExpression: 'ownerUid = :ownerUid',
        ExpressionAttributeValues: {
          ':ownerUid': FIREBASE_UID,
        },
      })
    );

    if (orgsResult.Items && orgsResult.Items.length > 0) {
      for (const org of orgsResult.Items) {
        console.log(`   Updating organization: ${org.name}`);
        await docClient.send(
          new UpdateCommand({
            TableName: 'mokoji-organizations',
            Key: { organizationId: org.organizationId },
            UpdateExpression: 'SET ownerUid = :newOwnerUid',
            ExpressionAttributeValues: {
              ':newOwnerUid': COGNITO_SUB,
            },
          })
        );
        console.log(`   ✅ Updated organization: ${org.name}`);
      }
    } else {
      console.log('   ⚠️ No organizations found');
    }
  } catch (error) {
    console.error('   ❌ Error updating organizations:', error);
  }

  // 3. Update schedules table (if any)
  console.log('\n3️⃣ Checking schedules table...');
  try {
    const schedulesResult = await docClient.send(
      new ScanCommand({
        TableName: 'mokoji-schedules',
        FilterExpression: 'contains(createdByUid, :uid) OR contains(uploaderUid, :uid)',
        ExpressionAttributeValues: {
          ':uid': FIREBASE_UID,
        },
      })
    );

    if (schedulesResult.Items && schedulesResult.Items.length > 0) {
      for (const schedule of schedulesResult.Items) {
        const updateExpr = [];
        const attrValues: any = {};

        if (schedule.createdByUid === FIREBASE_UID) {
          updateExpr.push('createdByUid = :newUid');
          attrValues[':newUid'] = COGNITO_SUB;
        }
        if (schedule.uploaderUid === FIREBASE_UID) {
          updateExpr.push('uploaderUid = :newUid');
          attrValues[':newUid'] = COGNITO_SUB;
        }

        if (updateExpr.length > 0) {
          console.log(`   Updating schedule: ${schedule.scheduleId}`);
          await docClient.send(
            new UpdateCommand({
              TableName: 'mokoji-schedules',
              Key: { scheduleId: schedule.scheduleId },
              UpdateExpression: `SET ${updateExpr.join(', ')}`,
              ExpressionAttributeValues: attrValues,
            })
          );
          console.log(`   ✅ Updated schedule: ${schedule.scheduleId}`);
        }
      }
    } else {
      console.log('   ⚠️ No schedules found');
    }
  } catch (error) {
    console.error('   ❌ Error updating schedules:', error);
  }

  console.log('\n✅ Migration completed!');
}

migrateUIDs().catch(console.error);
