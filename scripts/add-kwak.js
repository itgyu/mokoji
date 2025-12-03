const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");

const client = new DynamoDBClient({ region: "ap-northeast-2" });

async function addKwak() {
  const userId = "QnQz4IfcWGaNWiCEg6IcYBXeKjl1";
  const organizationId = "LDOcG25Y4SvxNqGifSek";
  const memberId = `member-${userId}-${organizationId}`;
  const joinedAt = new Date("2025-08-15T00:00:00+09:00").getTime();

  const item = {
    memberId: memberId,
    userId: userId,
    organizationId: organizationId,
    role: "member",
    status: "active",
    joinedAt: joinedAt,
    createdAt: joinedAt,
    updatedAt: Date.now()
  };

  await client.send(new PutItemCommand({
    TableName: "mokoji-organization-members",
    Item: marshall(item)
  }));

  console.log("곽수현을 멤버로 추가하고 가입일을 2025-08-15로 설정했습니다.");
}

addKwak().catch(console.error);
