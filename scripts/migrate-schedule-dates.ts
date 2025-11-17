import { db } from '../lib/firebase'
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'

/**
 * 한국어 날짜 형식을 ISO 문자열로 변환
 * 예: "11/1(토)" → "2025-11-01"
 *     "11/1(토) 오전 12:00" → "2025-11-01"
 *     "12/6(토)" → "2025-12-06"
 */
function parseKoreanDateToISO(koreanDate: string): string {
  try {
    // 날짜 부분만 추출 (시간 정보 제거)
    // "11/1(토) 오전 12:00" → "11/1"
    const dateOnly = koreanDate.split('(')[0].trim()

    // "11/1" → month: 11, day: 1
    const parts = dateOnly.split('/')
    if (parts.length !== 2) {
      console.warn('⚠️  날짜 형식이 올바르지 않음:', koreanDate)
      return new Date().toISOString().split('T')[0]
    }

    const month = parseInt(parts[0])
    const day = parseInt(parts[1])

    if (isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
      console.warn('⚠️  유효하지 않은 날짜:', koreanDate)
      return new Date().toISOString().split('T')[0]
    }

    // 기본적으로 현재 년도(2025)를 사용
    // 일정이 과거든 미래든 2025년으로 설정
    const year = 2025

    // ISO 형식으로 변환: YYYY-MM-DD
    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    // 유효성 검증
    const testDate = new Date(isoDate)
    if (isNaN(testDate.getTime())) {
      console.warn('⚠️  생성된 날짜가 유효하지 않음:', isoDate)
      return new Date().toISOString().split('T')[0]
    }

    return isoDate
  } catch (error) {
    console.error('❌ 날짜 변환 오류:', error)
    return new Date().toISOString().split('T')[0]
  }
}

async function migrateScheduleDates() {
  console.log('🔄 일정 날짜를 ISO 문자열로 마이그레이션 시작...\n')

  try {
    // schedules 컬렉션 조회
    console.log('📦 schedules 컬렉션 조회 중...')
    const schedulesSnapshot = await getDocs(collection(db, 'schedules'))
    console.log(`  총 ${schedulesSnapshot.size}개 일정 발견\n`)

    let updated = 0
    let skipped = 0
    let failed = 0

    for (const scheduleDoc of schedulesSnapshot.docs) {
      const data = scheduleDoc.data()
      const date = data.date

      if (!date) {
        console.log(`  ⚠️  [${scheduleDoc.id}] date 필드 없음 - 건너뜀`)
        skipped++
        continue
      }

      // date가 이미 ISO 형식이면 건너뛰기 (YYYY-MM-DD 형식 체크)
      if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        console.log(`  ✓  [${data.title}] date가 이미 ISO 형식 - 건너뜀`)
        skipped++
        continue
      }

      // dateISO가 있어도 재계산하여 업데이트 (잘못된 년도 수정)

      try {
        const isoDate = parseKoreanDateToISO(date)

        await updateDoc(doc(db, 'schedules', scheduleDoc.id), {
          dateISO: isoDate
        })

        console.log(`  ✅ [${data.title}] "${date}" → "${isoDate}"`)
        updated++
      } catch (error: any) {
        console.error(`  ❌ [${data.title}] 업데이트 실패:`, error.message)
        failed++
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ 마이그레이션 완료!')
    console.log(`   업데이트: ${updated}개`)
    console.log(`   건너뜀: ${skipped}개`)
    console.log(`   실패: ${failed}개`)
    console.log('='.repeat(60))

  } catch (error: any) {
    console.error('\n❌ 마이그레이션 실패:', error.message)
    console.error('상세:', error)
    throw error
  }
}

// 실행
console.log('='.repeat(60))
console.log('일정 날짜 → ISO 문자열 마이그레이션')
console.log('한국어 형식 → "YYYY-MM-DD"')
console.log('='.repeat(60))
console.log('')

migrateScheduleDates()
  .then(() => {
    console.log('\n✅ 스크립트 실행 완료')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 스크립트 실행 실패')
    console.error(error)
    process.exit(1)
  })
