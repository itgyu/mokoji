import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'ap-northeast-2' });
const docClient = DynamoDBDocumentClient.from(client);

// Firebase ID → Cognito ID 매핑
const ID_MAPPING: Record<string, string> = {
  // 콘솔 에러에서 보고된 사용자들
  'rwT5vvwMBfYZ16Hg7VwZEngVxeu2': '8448ed9c-0011-709d-353a-11a84901ee2b', // 정수현
  't8HLC8aD4cedOAMmJw2j5MDGhd43': 'a4885ddc-50a1-7028-00a2-a717584a8a03', // 김지완
  'fJsi4KvBQxU9M4jg9RG0jYYvQQr1': '7408addc-6031-702c-9e14-efd88ee03947', // 이정익
  'jM4obY7rxcOj17wbV8r7bR2Muzf2': 'f448cdbc-70a1-7065-b2c3-b53fc9c93a78', // 정영근
  'x0l6uQJZCEXlxlp7D7PDDdrkyM22': '5418bd9c-7061-70db-8a87-a698ce67cf40', // 송두나

  // 추가 사용자들 (이메일로 Cognito ID 확인됨)
  '3BG36fSW5vhm2d2lLzKf36JLYoM2': '54f8bdfc-0021-7032-e200-21e14fd70cd2', // 김시윤
  'ePtHpj95tuOxokVBum4uU02PmJn2': '44b87d2c-50d1-7030-c19b-c22cc1c196bf', // 김은정
  'iqAnVQ2tWwOLcP7arSAujx4qnKk1': '64e88dbc-20b1-70c2-e0b4-3584e926c9ac', // 박소연
  'jcap8UJrciZpUl66i7fPJpzgRgW2': 'd408dd3c-4091-7051-eba8-8f8f71f3698c', // 주윤경
  'WIRoWFcL6lV95YpHkwuvghlDp0p1': '84989d3c-3021-7043-9eb2-f9f375ce8435', // 권윤지
};

// Cognito에 없는 사용자들 (Firebase ID 유지 또는 삭제해야 할 수도 있음)
// gBCojvnY5dekGgC0AJf2eJD2dxP2 - 정제영 (Cognito 없음)
// kODxwEwwtqMuU60MyTlbA02sgsC2 - 김민지 (Cognito 없음)
// Qkl9CQVSjFhBdUy2AWCyAbPNXff1 - 권유나 (Cognito 없음)
// YEsPLlS5RNejRYtE7hsyB1u2l372 - 최은영 (Cognito 없음)

interface OrgMember {
  memberId: string;
  organizationId: string;
  userId: string;
  [key: string]: any;
}

async function fixOrgMembers() {
  console.log('=== organization-members 테이블 userId 수정 시작 ===\n');

  // 모든 멤버 가져오기
  const scanResult = await docClient.send(new ScanCommand({
    TableName: 'mokoji-organization-members',
  }));

  const members = (scanResult.Items || []) as OrgMember[];
  console.log(`총 ${members.length}개 멤버 레코드 발견\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let notMappedCount = 0;

  for (const member of members) {
    const oldUserId = member.userId;
    const newUserId = ID_MAPPING[oldUserId];

    if (newUserId) {
      console.log(`[${member.organizationId}] ${oldUserId} → ${newUserId}`);

      // organization-members 테이블의 키는 memberId (composite key)
      // userId가 키의 일부가 아니면 UpdateCommand로 가능하지만,
      // userId가 키의 일부라면 Delete + Put 필요

      // 먼저 기존 레코드 삭제
      try {
        await docClient.send(new DeleteCommand({
          TableName: 'mokoji-organization-members',
          Key: { memberId: member.memberId },
        }));

        // 새 userId로 레코드 생성
        const newMember = { ...member, userId: newUserId };
        await docClient.send(new PutCommand({
          TableName: 'mokoji-organization-members',
          Item: newMember,
        }));

        updatedCount++;
        console.log(`  ✅ 업데이트 완료\n`);
      } catch (error: any) {
        console.error(`  ❌ 업데이트 실패:`, error.message);
      }
    } else if (!oldUserId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)) {
      // Cognito UUID 형식이 아니고 매핑도 없으면 보고
      console.log(`⚠️ 매핑 없음: ${oldUserId} (memberId: ${member.memberId})`);
      notMappedCount++;
    } else {
      skippedCount++;
    }
  }

  console.log('\n=== 완료 ===');
  console.log(`업데이트된 멤버: ${updatedCount}개`);
  console.log(`매핑 없음 (Cognito 미등록): ${notMappedCount}개`);
  console.log(`변경 불필요: ${skippedCount}개`);
}

fixOrgMembers().catch(console.error);
