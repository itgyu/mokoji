/**
 * 일정 API 테스트
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'ap-northeast-2' });
const docClient = DynamoDBDocumentClient.from(client);

async function main() {
  const orgId = 'LDOcG25Y4SvxNqGifSek';

  console.log('=== 일정 조회 테스트 ===\n');
  console.log('Organization ID:', orgId);

  // GSI 쿼리
  const result = await docClient.send(
    new QueryCommand({
      TableName: 'mokoji-schedules',
      IndexName: 'organizationId-date-index',
      KeyConditionExpression: 'organizationId = :organizationId',
      ExpressionAttributeValues: {
        ':organizationId': orgId,
      },
    })
  );

  console.log('\n조회된 일정 수:', result.Items?.length);
  console.log('\n일정 목록:');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const item of result.Items || []) {
    const dateISO = item.dateISO;
    const scheduleDate = dateISO ? new Date(dateISO) : null;
    const isPast = scheduleDate ? scheduleDate < today : false;

    console.log(`- ${item.title}`);
    console.log(`  date: ${item.date}, dateISO: ${dateISO}`);
    console.log(`  isPast: ${isPast}`);
    console.log();
  }
}

main().catch(console.error);
