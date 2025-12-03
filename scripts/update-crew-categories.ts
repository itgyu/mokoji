/**
 * 크루 카테고리를 시스템 표준 카테고리로 업데이트하는 스크립트
 *
 * 실행: npx tsx scripts/update-crew-categories.ts
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'ap-northeast-2' });
const docClient = DynamoDBDocumentClient.from(client);

// 시스템 표준 카테고리
const STANDARD_CATEGORIES = [
  '러닝/마라톤', '등산/트레킹', '클라이밍', '풋살/축구', '독서 모임',
  '영어 회화', '배드민턴', '테니스', '골프', '맛집 투어',
  '캠핑/백패킹', '카페 투어', '영화 관람', '보드게임', '사진/출사',
  '와인/위스키', '댄스', '밴드/악기', '노래방', '반려동물',
  '주식/투자', 'N잡/부업', '코딩/개발', '드로잉/미술', '전시회 관람',
  '볼링', '당구', '자전거', '요가/필라테스', '수영',
  '베이킹/쿠킹', '서핑', '스키/보드', '게임/e스포츠', '봉사활동',
  '글쓰기', '미라클모닝', '공예/DIY', '가드닝', '타로/사주',
  '드라이브', '명상', '보드(스케보)', '크로스핏', '애니/덕질', '동네 친구'
];

// 카테고리 매핑 (기존 -> 표준)
const CATEGORY_MAPPING: { [key: string]: string } = {
  // 캠핑 관련
  '캠핑': '캠핑/백패킹',
  '백패킹': '캠핑/백패킹',
  '차박': '캠핑/백패킹',
  '비박': '캠핑/백패킹',

  // 등산/트레킹 관련
  '등산': '등산/트레킹',
  '등산/산행': '등산/트레킹',
  '트레킹': '등산/트레킹',
  '국내트레킹': '등산/트레킹',
  '해외트레킹': '등산/트레킹',
  '산행': '등산/트레킹',

  // 러닝 관련
  '러닝': '러닝/마라톤',
  '마라톤': '러닝/마라톤',
  '조깅': '러닝/마라톤',

  // 기타
  '축구': '풋살/축구',
  '풋살': '풋살/축구',
  '독서': '독서 모임',
  '영어': '영어 회화',
  '사진': '사진/출사',
  '출사': '사진/출사',
  '와인': '와인/위스키',
  '위스키': '와인/위스키',
  '요가': '요가/필라테스',
  '필라테스': '요가/필라테스',
  '스키': '스키/보드',
  '보드': '스키/보드',
  '스노보드': '스키/보드',
  '베이킹': '베이킹/쿠킹',
  '쿠킹': '베이킹/쿠킹',
  '요리': '베이킹/쿠킹',
  '게임': '게임/e스포츠',
  '드로잉': '드로잉/미술',
  '미술': '드로잉/미술',
  '공예': '공예/DIY',
  'DIY': '공예/DIY',
  '밴드': '밴드/악기',
  '악기': '밴드/악기',
  '맛집': '맛집 투어',
  '카페': '카페 투어',
};

async function updateCrewCategories() {
  console.log('크루 카테고리 업데이트 시작...\n');

  // 모든 크루 조회
  const scanResult = await docClient.send(new ScanCommand({
    TableName: 'mokoji-organizations',
  }));

  const organizations = scanResult.Items || [];
  console.log(`총 ${organizations.length}개 크루 발견\n`);

  for (const org of organizations) {
    const orgId = org.organizationId;
    const orgName = org.name;
    const currentCategories = org.categories || [];

    console.log(`\n크루: ${orgName}`);
    console.log(`  현재 카테고리: ${JSON.stringify(currentCategories)}`);

    // 카테고리 매핑
    const newCategories: string[] = [];
    const seen = new Set<string>();

    for (const cat of currentCategories) {
      let mappedCat = cat;

      // 매핑 테이블에서 찾기
      if (CATEGORY_MAPPING[cat]) {
        mappedCat = CATEGORY_MAPPING[cat];
      }
      // 표준 카테고리에 있으면 그대로 사용
      else if (STANDARD_CATEGORIES.includes(cat)) {
        mappedCat = cat;
      }
      // 부분 매칭 시도
      else {
        const found = STANDARD_CATEGORIES.find(std =>
          std.toLowerCase().includes(cat.toLowerCase()) ||
          cat.toLowerCase().includes(std.split('/')[0].toLowerCase())
        );
        if (found) {
          mappedCat = found;
        } else {
          console.log(`  ⚠️ 매핑 없음: "${cat}" -> 스킵`);
          continue;
        }
      }

      // 중복 제거
      if (!seen.has(mappedCat)) {
        seen.add(mappedCat);
        newCategories.push(mappedCat);
      }
    }

    console.log(`  새 카테고리: ${JSON.stringify(newCategories)}`);

    // 변경된 경우에만 업데이트
    if (JSON.stringify(currentCategories.sort()) !== JSON.stringify(newCategories.sort())) {
      await docClient.send(new UpdateCommand({
        TableName: 'mokoji-organizations',
        Key: { organizationId: orgId },
        UpdateExpression: 'SET categories = :categories',
        ExpressionAttributeValues: {
          ':categories': newCategories,
        },
      }));
      console.log(`  ✅ 업데이트 완료!`);
    } else {
      console.log(`  - 변경 없음`);
    }
  }

  console.log('\n\n모든 크루 카테고리 업데이트 완료!');
}

updateCrewCategories().catch(console.error);
