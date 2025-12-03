/**
 * Fix missing status field in participants
 *
 * Most schedules have participants without 'status' field
 * This script adds status: 'going' to all participants that don't have it
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
    console.log(`⏭️ ${title}: No participants, skipping`);
    return false;
  }

  // Check if any participant is missing status
  const needsFix = participants.some((p: any) => !p.status);

  if (!needsFix) {
    console.log(`✅ ${title}: All participants have status`);
    return false;
  }

  // Fix participants - add status: 'going' if missing
  const fixedParticipants = participants.map((p: any) => {
    if (p.status) return p;

    return {
      ...p,
      status: 'going',
      respondedAt: p.respondedAt || Date.now(),
    };
  });

  // Update schedule
  await docClient.send(new UpdateCommand({
    TableName: "mokoji-schedules",
    Key: { scheduleId },
    UpdateExpression: "SET participants = :participants",
    ExpressionAttributeValues: {
      ":participants": fixedParticipants,
    },
  }));

  console.log(`🔧 ${title}: Fixed ${participants.length} participants`);
  return true;
}

async function main() {
  console.log("Fetching all schedules...\n");

  const schedules = await getAllSchedules();
  console.log(`Found ${schedules.length} schedules\n`);

  let fixedCount = 0;
  for (const schedule of schedules) {
    try {
      const fixed = await fixSchedule(schedule);
      if (fixed) fixedCount++;
    } catch (error) {
      console.error(`❌ Error fixing ${schedule.title}:`, error);
    }
  }

  console.log(`\n=== Done! Fixed ${fixedCount} schedules ===`);
}

main().catch(console.error);
