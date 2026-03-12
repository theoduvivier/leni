import { db } from '@leni/db'
import OpenAI from 'openai'

const MODEL = 'gpt-4.1-nano' as const

let _openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI()
  return _openai
}

interface AlgoSource {
  name: string
  url: string
  platform: 'linkedin' | 'instagram' | 'both'
}

interface ExtractedRule {
  plateforme: string
  regle: string
  valeur: string
  confiance: 'haute' | 'moyenne' | 'faible'
}

const rssSources: AlgoSource[] = [
  { name: 'Social Media Examiner', url: 'https://www.socialmediaexaminer.com/feed/', platform: 'both' },
  { name: 'HubSpot Marketing', url: 'https://blog.hubspot.com/marketing/rss.xml', platform: 'both' },
  { name: 'Buffer Blog', url: 'https://buffer.com/resources/feed/', platform: 'both' },
  { name: 'Hootsuite Blog', url: 'https://blog.hootsuite.com/feed/', platform: 'both' },
  { name: 'Sprout Social', url: 'https://sproutsocial.com/insights/feed/', platform: 'both' },
  { name: 'Neil Patel', url: 'https://neilpatel.com/blog/feed/', platform: 'both' },
]

function log(level: string, message: string, extra?: Record<string, unknown>) {
  console.log(JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    service: 'algo-watcher',
    ...extra,
  }))
}

async function fetchRSS(url: string): Promise<{ title: string; link: string; snippet: string }[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Leni-AlgoWatcher/1.0' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return []

    const xml = await res.text()
    const items: { title: string; link: string; snippet: string }[] = []

    // Simple XML parsing for RSS items
    const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi
    let match
    while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
      const itemXml = match[1]
      const title = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1] ?? ''
      const link = itemXml.match(/<link[^>]*>(.*?)<\/link>/)?.[1] ?? ''
      const desc = itemXml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1] ?? ''

      // Filter: only keep articles about algorithms, social media strategy, LinkedIn, Instagram
      const keywords = ['algorithm', 'linkedin', 'instagram', 'engagement', 'reach', 'feed', 'hashtag', 'content strategy', 'social media']
      const text = `${title} ${desc}`.toLowerCase()
      if (keywords.some(k => text.includes(k))) {
        items.push({
          title: title.replace(/<[^>]+>/g, '').trim(),
          link: link.replace(/<[^>]+>/g, '').trim(),
          snippet: desc.replace(/<[^>]+>/g, '').substring(0, 500).trim(),
        })
      }
    }

    return items
  } catch {
    return []
  }
}

async function analyzeWithLLM(articles: { source: string; title: string; snippet: string }[]): Promise<ExtractedRule[]> {
  if (articles.length === 0) return []

  const prompt = articles
    .map((a, i) => `[${i + 1}] Source: ${a.source}\nTitre: ${a.title}\nExtrait: ${a.snippet}`)
    .join('\n\n')

  const response = await getOpenAI().chat.completions.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: 'system',
        content: `Tu es un analyste spécialisé dans les algorithmes LinkedIn et Instagram.
À partir des articles fournis, extrais les règles concrètes et actionnables pour optimiser la visibilité.

Retourne un JSON array avec pour chaque règle :
{
  "plateforme": "linkedin" | "instagram",
  "regle": "nom court de la règle",
  "valeur": "description actionnable (1-2 phrases)",
  "confiance": "haute" | "moyenne" | "faible"
}

Règles :
- N'extrais QUE les changements algorithmiques récents ou best practices vérifiées
- Ignore les conseils génériques évidents
- Maximum 15 règles
- Retourne UNIQUEMENT le JSON array, rien d'autre`,
      },
      { role: 'user', content: prompt },
    ],
  })

  const result = response.choices[0]?.message?.content ?? ''

  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []
    return JSON.parse(jsonMatch[0]) as ExtractedRule[]
  } catch {
    log('error', 'Failed to parse LLM response', { raw: result.substring(0, 200) })
    return []
  }
}

export async function runAlgoWatch(): Promise<{
  sourcesScraped: number
  articlesFound: number
  rulesExtracted: number
  rulesApplied: number
  skillsUpdated: number
}> {
  log('info', 'Starting algo watch scan')

  // 1. Scrape RSS sources
  const allArticles: { source: string; title: string; snippet: string }[] = []
  let sourcesScraped = 0

  for (const source of rssSources) {
    const items = await fetchRSS(source.url)
    sourcesScraped++
    for (const item of items) {
      allArticles.push({ source: source.name, title: item.title, snippet: item.snippet })
    }
    log('info', `Scraped ${source.name}: ${items.length} relevant articles`)
  }

  log('info', `Total articles found: ${allArticles.length}`, { sourcesScraped })

  // 2. Analyze with LLM
  const rules = await analyzeWithLLM(allArticles)
  log('info', `Rules extracted: ${rules.length}`)

  // 3. Store rules in DB
  let rulesApplied = 0
  for (const rule of rules) {
    // Check if similar rule exists
    const existing = await db.algoRule.findFirst({
      where: {
        plateforme: rule.plateforme,
        regle: rule.regle,
        actif: true,
      },
    })

    if (existing) {
      // Update if value changed
      if (existing.valeur !== rule.valeur) {
        await db.algoRule.update({
          where: { id: existing.id },
          data: { valeur: rule.valeur, confiance: rule.confiance, source: 'algo-watcher' },
        })
        rulesApplied++
      }
    } else {
      await db.algoRule.create({
        data: {
          plateforme: rule.plateforme,
          regle: rule.regle,
          valeur: rule.valeur,
          source: 'algo-watcher',
          confiance: rule.confiance,
        },
      })
      rulesApplied++
    }
  }

  // 4. Auto-update skills with high-confidence rules
  let skillsUpdated = 0
  const highConfRules = rules.filter(r => r.confiance === 'haute')

  if (highConfRules.length > 0) {
    const linkedinRules = highConfRules.filter(r => r.plateforme === 'linkedin')
    const instagramRules = highConfRules.filter(r => r.plateforme === 'instagram')

    if (linkedinRules.length > 0) {
      const updated = await updateSkillWithRules('linkedin_post_texte', linkedinRules)
      if (updated) skillsUpdated++
    }
    if (instagramRules.length > 0) {
      const updated = await updateSkillWithRules('instagram_caption', instagramRules)
      if (updated) skillsUpdated++
    }
  }

  const result = {
    sourcesScraped,
    articlesFound: allArticles.length,
    rulesExtracted: rules.length,
    rulesApplied,
    skillsUpdated,
  }

  log('info', 'Algo watch scan completed', result)
  return result
}

async function updateSkillWithRules(skillNom: string, rules: ExtractedRule[]): Promise<boolean> {
  const skill = await db.skill.findFirst({ where: { nom: skillNom, actif: true } })
  if (!skill) return false

  const rulesSection = rules
    .map(r => `- ${r.regle}: ${r.valeur}`)
    .join('\n')

  const algoBlock = `\n\n## Règles algo (auto-updated ${new Date().toISOString().split('T')[0]})\n${rulesSection}`

  // Remove previous auto-updated section if exists
  const cleanContent = skill.contenu.replace(/\n\n## Règles algo \(auto-updated.*?\)[\s\S]*?(?=\n\n##|$)/, '')
  const newContent = cleanContent + algoBlock

  // Save history before updating
  await db.skillHistory.create({
    data: {
      skillId: skill.id,
      contenu: skill.contenu,
      version: skill.version,
    },
  })

  // Bump version
  const parts = skill.version.split('.')
  parts[2] = String(Number(parts[2]) + 1)
  const newVersion = parts.join('.')

  await db.skill.update({
    where: { id: skill.id },
    data: {
      contenu: newContent,
      version: newVersion,
      updatedBy: 'algo-watcher',
    },
  })

  log('info', `Skill ${skillNom} updated to ${newVersion}`, { rulesCount: rules.length })
  return true
}
