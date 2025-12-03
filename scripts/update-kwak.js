const { DynamoDBClient, ScanCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

const client = new DynamoDBClient({ region: "ap-northeast-2" });

async function findAndUpdateKwak() {
  // 1. users 테이블에서 곽수현 찾기
  const usersResult = await client.send(new ScanCommand({
    TableName: "mokoji-users",
    FilterExpression: "contains(#name, :name)",
    ExpressionAttributeNames: { "#name": "name" },
    ExpressionAttributeValues: { ":name": { S: "곽수현" } }
  }));

  if (!usersResult.Items || usersResult.Items.length === 0) {
    console.log("곽수현을 찾을 수 없습니다.");
    return;
  }

  const user = unmarshall(usersResult.Items[0]);
  console.log("곽수현 userId:", user.userId);

  // 2. organization-members에서 해당 userId로 멤버 찾기
  const membersResult = await client.send(new ScanCommand({
    TableName: "mokoji-organization-members",
    FilterExpression: "userId = :userId",
    ExpressionAttributeValues: { ":userId": { S: user.userId } }
  }));

  if (!membersResult.Items || membersResult.Items.length === 0) {
    console.log("곽수현이 멤버 테이블에 없습니다.");
    return;
  }

  const member = unmarshall(membersResult.Items[0]);
  console.log("memberId:", member.memberId);

  // 3. 가입일 업데이트
  const joinedAt = new Date("2025-08-15T00:00:00+09:00").getTime();

  await client.send(new UpdateItemCommand({
    TableName: "mokoji-organization-members",
    Key: {
      memberId: { S: member.memberId }
    },
    UpdateExpression: "SET joinedAt = :joinedAt",
    ExpressionAttributeValues: {
      ":joinedAt": { N: String(joinedAt) }
    }
  }));

  console.log("곽수현 가입일을 2025-08-15로 변경했습니다.");
}

findAndUpdateKwak().catch(console.error);
