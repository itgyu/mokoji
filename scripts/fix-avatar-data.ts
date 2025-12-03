/**
 * Fix oversized userAvatar in participants
 *
 * Some participants have base64 image data stored in userAvatar field
 * This causes DynamoDB item size to exceed 400KB limit
 *
 * This script removes base64 data and keeps only URLs
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

const ORG_ID = "LDOcG25Y4SvxNqGifSek";

function isBase64Image(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  // Base64 images start with data:image or are very long without http
  return str.startsWith('data:image') || (str.length > 1000 && !str.startsWith('http'));
}

async function getAllSchedules() {
  const allItems: any[] = [];
  let lastEvaluatedKey: any = undefined;

  do {
    const result = await docClient.send(new ScanCommand({
      TableName: "mokoji-schedules",
      FilterExpression: "organizationId = :orgId",
      ExpressionAttributeValues: {
        ":orgId": ORG_ID,
      },
      ExclusiveStartKey: lastEvaluatedKey,
    }));
    allItems.push(...(result.Items || []));
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return allItems;
}

async function fixSchedule(schedule: any) {
  const { scheduleId, title, participants } = schedule;

  if (!participants || participants.length === 0) {
    return false;
  }

  let needsFix = false;
  const fixedParticipants = participants.map((p: any) => {
    if (p.userAvatar && isBase64Image(p.userAvatar)) {
      needsFix = true;
      console.log(`  - ${p.userName}: removing ${p.userAvatar.length} bytes base64 avatar`);
      return {
        ...p,
        userAvatar: null, // Remove base64 data
      };
    }
    return p;
  });

  if (!needsFix) {
    return false;
  }

  // Calculate new size
  const newSize = JSON.stringify(fixedParticipants).length;
  console.log(`  New participants size: ${newSize} bytes`);

  // Update schedule
  await docClient.send(new UpdateCommand({
    TableName: "mokoji-schedules",
    Key: { scheduleId },
    UpdateExpression: "SET participants = :participants, updatedAt = :updatedAt",
    ExpressionAttributeValues: {
      ":participants": fixedParticipants,
      ":updatedAt": Date.now(),
    },
  }));

  return true;
}

async function main() {
  console.log("Scanning all schedules for oversized avatars...\n");

  const schedules = await getAllSchedules();
  console.log(`Found ${schedules.length} schedules\n`);

  let fixedCount = 0;
  for (const schedule of schedules) {
    const size = JSON.stringify(schedule.participants || []).length;
    if (size > 10000) { // Only check schedules with large participant data
      console.log(`\n${schedule.title}: ${size} bytes`);
      try {
        const fixed = await fixSchedule(schedule);
        if (fixed) fixedCount++;
      } catch (error) {
        console.error(`Error fixing ${schedule.title}:`, error);
      }
    }
  }

  console.log(`\n=== Done! Fixed ${fixedCount} schedules ===`);
}

main().catch(console.error);
