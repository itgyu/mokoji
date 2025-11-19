const fs = require('fs')
const path = require('path')

// Files to process
const filesToProcess = [
  'app/dashboard/page.tsx',
  'app/schedules/[scheduleId]/components/ScheduleSummaryCard.tsx',
  'app/schedules/[scheduleId]/components/EmptyChatState.tsx',
  'app/schedules/[scheduleId]/components/ChatSettingsSheet.tsx',
  'app/schedules/[scheduleId]/ScheduleDetailClient.tsx'
]

filesToProcess.forEach(filePath => {
  const fullPath = path.join(__dirname, '..', filePath)

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`)
    return
  }

  let content = fs.readFileSync(fullPath, 'utf-8')

  // Check if lucide-react imports exist
  const hasLucideImport = content.includes("from 'lucide-react'")

  // Get required icons for this file
  const requiredIcons = new Set()
  if (content.includes('⛺')) requiredIcons.add('Tent')
  if (content.includes('📅')) requiredIcons.add('Calendar')
  if (content.includes('📍')) requiredIcons.add('MapPin')
  if (content.includes('🎯')) requiredIcons.add('Target')
  if (content.includes('💬')) requiredIcons.add('MessageCircle')
  if (content.includes('👥')) requiredIcons.add('Users')
  if (content.includes('🔍')) requiredIcons.add('Search')
  if (content.includes('➕')) requiredIcons.add('Plus')
  if (content.includes('✓')) requiredIcons.add('Check')
  if (content.includes('💡')) requiredIcons.add('Lightbulb')
  if (content.includes('✨')) requiredIcons.add('Sparkles')
  if (content.includes('🌟')) requiredIcons.add('Star')
  if (content.includes('⚙️')) requiredIcons.add('Settings')

  // Add lucide-react imports if needed
  if (requiredIcons.size > 0 && !hasLucideImport) {
    const imports = content.match(/^import .+$/gm) || []
    const lastImportIndex = content.lastIndexOf(imports[imports.length - 1])
    const afterLastImport = lastImportIndex + imports[imports.length - 1].length

    const lucideImport = `\nimport { ${Array.from(requiredIcons).sort().join(', ')} } from 'lucide-react'`

    content = content.slice(0, afterLastImport) + lucideImport + content.slice(afterLastImport)
  }

  // Dashboard-specific replacements
  if (filePath.includes('dashboard/page.tsx')) {
    // Tent emoji (⛺) in various places
    content = content.replace(/<div className="w-full h-full flex items-center justify-center text-base md:text-lg md:text-xl md:text-2xl">⛺<\/div>/g,
      '<div className="w-full h-full flex items-center justify-center"><Tent className="w-5 h-5 md:w-6 md:h-6 text-[#FF9B50]" /></div>')

    content = content.replace(/<div className="w-full h-full flex items-center justify-center text-base md:text-lg md:text-xl md:text-2xl md:text-3xl">⛺<\/div>/g,
      '<div className="w-full h-full flex items-center justify-center"><Tent className="w-5 h-5 md:w-6 md:h-6 md:w-7 md:h-7 text-[#FF9B50]" /></div>')

    content = content.replace(/<h1 className="text-base md:text-lg md:text-xl md:text-2xl font-bold tracking-tight text-\[#292524\]">⛺ 내 크루<\/h1>/g,
      '<h1 className="text-base md:text-lg md:text-xl md:text-2xl font-bold tracking-tight text-[#292524] flex items-center gap-2"><Tent className="w-5 h-5 md:w-6 md:h-6 text-[#FF9B50]" />내 크루</h1>')

    content = content.replace(/<div className="text-6xl mb-4">⛺<\/div>/g,
      '<div className="flex justify-center mb-4"><Tent className="w-16 h-16 text-[#FF9B50]" /></div>')

    // Search emoji
    content = content.replace(/<div className="text-5xl mb-3">🔍<\/div>/g,
      '<div className="flex justify-center mb-3"><Search className="w-14 h-14 text-[#FF9B50]" /></div>')

    // Plus emoji
    content = content.replace(/<div className="text-4xl">➕<\/div>/g,
      '<div className="flex items-center justify-center"><Plus className="w-10 h-10 text-[#FF9B50]" /></div>')

    // Check marks
    content = content.replace(/✓ 참여 중/g,
      '<span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5 text-green-600" />참여 중</span>')

    content = content.replace(/✓ 참여함/g,
      '<span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5 text-green-600" />참여함</span>')

    // People emoji (👥)
    content = content.replace(/<span>👥<\/span>/g,
      '<Users className="w-4 h-4 text-[#FF9B50] flex-shrink-0" />')

    content = content.replace(/<div className="text-base font-bold text-\[#292524\]">👥 참여 인원<\/div>/g,
      '<div className="text-base font-bold text-[#292524] flex items-center gap-1.5"><Users className="w-5 h-5 text-[#FF9B50]" />참여 인원</div>')
  }

  // Schedule components replacements
  if (filePath.includes('ScheduleSummaryCard.tsx')) {
    content = content.replace(/📅/g,
      '<Calendar className="w-4 h-4 text-[#FF9B50] flex-shrink-0" />')

    content = content.replace(/📍/g,
      '<MapPin className="w-4 h-4 text-[#FF9B50] flex-shrink-0" />')

    content = content.replace(/<span>👥<\/span>/g,
      '<Users className="w-4 h-4 text-[#FF9B50] flex-shrink-0" />')
  }

  if (filePath.includes('EmptyChatState.tsx')) {
    content = content.replace(/💬/g,
      '<MessageCircle className="w-5 h-5 text-[#FF9B50]" />')

    content = content.replace(/💡/g,
      '<Lightbulb className="w-5 h-5 text-[#FF9B50]" />')
  }

  if (filePath.includes('ChatSettingsSheet.tsx')) {
    content = content.replace(/💬/g,
      '<MessageCircle className="w-4 h-4 text-[#FF9B50] inline-block" />')
  }

  if (filePath.includes('ScheduleDetailClient.tsx')) {
    content = content.replace(/👥 참여자 추가/g,
      '<span className="inline-flex items-center gap-1.5"><Users className="w-4 h-4" />참여자 추가</span>')
  }

  // Write the modified content
  fs.writeFileSync(fullPath, content, 'utf-8')

  console.log(`✅ ${filePath}`)
})

console.log('\n🎉 All emojis replaced successfully!')
