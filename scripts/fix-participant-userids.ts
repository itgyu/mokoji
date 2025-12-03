/**
 * Fix participant userIds from Firebase UID to Cognito UUID
 *
 * Some participants have old Firebase UIDs instead of Cognito UUIDs
 * This causes the "add participant" filter to not work correctly
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

// Cognito UUID pattern: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
function isCognitoUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
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

async function getAllUsers() {
  const allItems: any[] = [];
  let lastEvaluatedKey: any = undefined;

  do {
    const result = await docClient.send(new ScanCommand({
      TableName: "mokoji-users",
      ExclusiveStartKey: lastEvaluatedKey,
    }));
    allItems.push(...(result.Items || []));
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return allItems;
}

async function main() {
  console.log("Fetching users and schedules...\n");

  const users = await getAllUsers();
  const schedules = await getAllSchedules();

  console.log(`Found ${users.length} users, ${schedules.length} schedules\n`);

  // Create name -> userId map (Cognito UUID)
  const nameToUserId = new Map<string, string>();
  users.forEach(user => {
    if (user.name && isCognitoUUID(user.userId)) {
      nameToUserId.set(user.name, user.userId);
    }
  });

  console.log(`Built name->userId map with ${nameToUserId.size} entries\n`);

  let totalFixed = 0;

  for (const schedule of schedules) {
    const { scheduleId, title, participants } = schedule;

    if (!participants || participants.length === 0) continue;

    let needsFix = false;
    const fixedParticipants = participants.map((p: any) => {
      // Skip if already Cognito UUID
      if (isCognitoUUID(p.userId)) {
        return p;
      }

      // Try to find Cognito UUID by name
      const cognitoUserId = nameToUserId.get(p.userName);
      if (cognitoUserId) {
        needsFix = true;
        console.log(`${title}: ${p.userName} - ${p.userId} -> ${cognitoUserId}`);
        return {
          ...p,
          userId: cognitoUserId,
        };
      }

      // Can't fix, keep as is
      console.log(`${title}: ${p.userName} - ${p.userId} (no match found)`);
      return p;
    });

    if (needsFix) {
      await docClient.send(new UpdateCommand({
        TableName: "mokoji-schedules",
        Key: { scheduleId },
        UpdateExpression: "SET participants = :participants, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":participants": fixedParticipants,
          ":updatedAt": Date.now(),
        },
      }));
      totalFixed++;
    }
  }

  console.log(`\n=== Done! Fixed ${totalFixed} schedules ===`);
}

main().catch(console.error);
