const fs = require('fs')
const path = require('path')

const dashboardPath = path.join(__dirname, '../app/dashboard/page.tsx')

// Read the file
let content = fs.readFileSync(dashboardPath, 'utf-8')

// Check if lucide-react imports exist
const hasLucideImport = content.includes("from 'lucide-react'")

// Add lucide-react imports if not present
if (!hasLucideImport) {
  // Find the last import statement
  const imports = content.match(/^import .+$/gm) || []
  const lastImportIndex = content.lastIndexOf(imports[imports.length - 1])
  const afterLastImport = lastImportIndex + imports[imports.length - 1].length

  const lucideImport = "\nimport { Calendar, MapPin, Target, MessageCircle, Sparkles, Star, Settings, Users } from 'lucide-react'"

  content = content.slice(0, afterLastImport) + lucideImport + content.slice(afterLastImport)
}

// Replace emojis with inline icon components
// Pattern: emoji alone in a span or div
const replacements = [
  // Console logs - just remove emojis from console logs
  {
    pattern: /console\.log\(`\\n🎯 (.*?)`\)/g,
    replacement: "console.log(`\\n\\uD83C\\uDFAF $1`)" // Keep emoji in console
  },

  // Stand-alone emoji in divs (empty states)
  {
    pattern: /<div className="text-6xl mb-4">📅<\/div>/g,
    replacement: '<div className="flex justify-center mb-4"><Calendar className="w-16 h-16 text-[#FF9B50]" /></div>'
  },
  {
    pattern: /<div className="text-5xl mb-3">📍<\/div>/g,
    replacement: '<div className="flex justify-center mb-3"><MapPin className="w-14 h-14 text-[#FF9B50]" /></div>'
  },
  {
    pattern: /<div className="text-4xl sm:text-5xl mb-2 sm:mb-3">📍<\/div>/g,
    replacement: '<div className="flex justify-center mb-2 sm:mb-3"><MapPin className="w-12 h-12 sm:w-14 sm:h-14 text-[#FF9B50]" /></div>'
  },

  // Inline emojis in headers/titles
  {
    pattern: /<h1 className="text-base md:text-lg md:text-xl md:text-2xl font-bold tracking-tight text-\[#292524\]">📅 다가오는 일정<\/h1>/g,
    replacement: '<h1 className="text-base md:text-lg md:text-xl md:text-2xl font-bold tracking-tight text-[#292524] flex items-center gap-2"><Calendar className="w-5 h-5 md:w-6 md:h-6 text-[#FF9B50]" />다가오는 일정</h1>'
  },
  {
    pattern: /✨ 나를 위한 추천 크루/g,
    replacement: '<span className="inline-flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#FF9B50]" />나를 위한 추천 크루</span>'
  },
  {
    pattern: /🌟 내 반경 내 전체 크루/g,
    replacement: '<span className="inline-flex items-center gap-2"><Star className="w-4 h-4 text-[#FF9B50]" />내 반경 내 전체 크루</span>'
  },
  {
    pattern: /⚙️ 크루 정보 수정/g,
    replacement: '<span className="inline-flex items-center gap-2"><Settings className="w-4 h-4" />크루 정보 수정</span>'
  },
  {
    pattern: /<span className="text-base font-bold text-\[#292524\]">💬 댓글<\/span>/g,
    replacement: '<span className="text-base font-bold text-[#292524] inline-flex items-center gap-2"><MessageCircle className="w-5 h-5 text-[#FF9B50]" />댓글</span>'
  },

  // Small inline emojis in text (like in schedule details)
  {
    pattern: /<span className="text-base md:text-lg">📅<\/span>/g,
    replacement: '<Calendar className="w-4 h-4 md:w-5 md:h-5 text-[#FF9B50] flex-shrink-0" />'
  },
  {
    pattern: /<span className="text-base md:text-lg">📍<\/span>/g,
    replacement: '<MapPin className="w-4 h-4 md:w-5 md:h-5 text-[#FF9B50] flex-shrink-0" />'
  },
  {
    pattern: /<span className="text-base md:text-lg">🎯<\/span>/g,
    replacement: '<Target className="w-4 h-4 md:w-5 md:h-5 text-[#FF9B50] flex-shrink-0" />'
  },

  // Bare emojis in spans
  {
    pattern: /<span>📅<\/span>/g,
    replacement: '<Calendar className="w-4 h-4 text-[#FF9B50] flex-shrink-0" />'
  },
  {
    pattern: /<span>📍<\/span>/g,
    replacement: '<MapPin className="w-4 h-4 text-[#FF9B50] flex-shrink-0" />'
  },
  {
    pattern: /<span>🎯<\/span>/g,
    replacement: '<Target className="w-4 h-4 text-[#FF9B50] flex-shrink-0" />'
  },
  {
    pattern: /<span>💬<\/span>/g,
    replacement: '<MessageCircle className="w-4 h-4 text-[#FF9B50] flex-shrink-0" />'
  },

  // Text content emojis (in string literals)
  {
    pattern: /(<p[^>]*>)\s*📅\s*/g,
    replacement: '$1<Calendar className="w-4 h-4 text-[#FF9B50] inline-block mr-1.5" />'
  },
  {
    pattern: /(<p[^>]*>)\s*📍\s*/g,
    replacement: '$1<MapPin className="w-4 h-4 text-[#FF9B50] inline-block mr-1.5" />'
  },
  {
    pattern: /(<p[^>]*>)\s*🎯\s*/g,
    replacement: '$1<Target className="w-4 h-4 text-[#FF9B50] inline-block mr-1.5" />'
  },
  {
    pattern: /(<p[^>]*>)\s*👥\s*/g,
    replacement: '$1<Users className="w-4 h-4 text-[#FF9B50] inline-block mr-1.5" />'
  },

  // Labels in modal details
  {
    pattern: /<div className="text-sm font-bold text-\[#A8A29E\] mb-2">📅 일시<\/div>/g,
    replacement: '<div className="text-sm font-bold text-[#A8A29E] mb-2 flex items-center gap-1.5"><Calendar className="w-4 h-4" />일시</div>'
  },
  {
    pattern: /<div className="text-sm font-bold text-\[#A8A29E\] mb-2">📍 장소<\/div>/g,
    replacement: '<div className="text-sm font-bold text-[#A8A29E] mb-2 flex items-center gap-1.5"><MapPin className="w-4 h-4" />장소</div>'
  },
  {
    pattern: /<div className="text-sm font-bold text-\[#A8A29E\] mb-2">🎯 벙주<\/div>/g,
    replacement: '<div className="text-sm font-bold text-[#A8A29E] mb-2 flex items-center gap-1.5"><Target className="w-4 h-4" />벙주</div>'
  },

  // Emoji in text with md breakpoints
  {
    pattern: /<span className="text-base md:text-lg md:text-xl">💬<\/span>/g,
    replacement: '<MessageCircle className="w-5 h-5 md:w-6 md:h-6 text-[#FF9B50]" />'
  },

  // Section headers with emojis
  {
    pattern: /<span className="text-xl sm:text-base md:text-lg md:text-xl md:text-2xl">📍<\/span>/g,
    replacement: '<MapPin className="w-5 h-5 sm:w-4 sm:h-4 md:w-5 md:h-5 md:w-6 md:h-6 text-[#FF9B50]" />'
  },

  // Schedule count badge
  {
    pattern: /<span>📅<\/span>\s*<span className="font-semibold">(\d+)개 일정<\/span>/g,
    replacement: '<Calendar className="w-3.5 h-3.5 text-[#FF9B50]" /><span className="font-semibold">$1개 일정</span>'
  },

  // Button text - location setting
  {
    pattern: /'📍 현재 위치로 설정'/g,
    replacement: "'현재 위치로 설정'"
  },

  // Crew location display
  {
    pattern: /<span>📍<\/span>\s*<span className="truncate">/g,
    replacement: '<MapPin className="w-3.5 h-3.5 text-[#FF9B50] flex-shrink-0" /><span className="truncate">'
  }
]

// Apply all replacements
replacements.forEach(({ pattern, replacement }) => {
  content = content.replace(pattern, replacement)
})

// Handle share text template - keep emojis in share text for now since it goes to external apps
// This is a multi-line template string, so we'll leave it as-is

// Write the modified content
fs.writeFileSync(dashboardPath, content, 'utf-8')

console.log('✅ Dashboard emojis replaced successfully!')
console.log('📝 Check the file for any remaining emojis that need manual adjustment')
