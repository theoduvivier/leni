import { db } from '@leni/db'
import { readFileSync } from 'fs'
import { join } from 'path'

const SKILLS_DIR = join(__dirname, '..', 'skills')

const skillFiles = [
  { file: 'linkedin_post_texte.md', nom: 'linkedin_post_texte', plateforme: 'linkedin' },
  { file: 'linkedin_post_image.md', nom: 'linkedin_post_image', plateforme: 'linkedin' },
  { file: 'linkedin_comment_trigger.md', nom: 'linkedin_comment_trigger', plateforme: 'linkedin' },
  { file: 'linkedin_ghostwriter.md', nom: 'linkedin_ghostwriter', plateforme: 'linkedin' },
  { file: 'instagram_caption.md', nom: 'instagram_caption', plateforme: 'instagram' },
  { file: 'instagram_story.md', nom: 'instagram_story', plateforme: 'instagram' },
]

export async function seedSkills() {
  for (const { file, nom, plateforme } of skillFiles) {
    const contenu = readFileSync(join(SKILLS_DIR, file), 'utf-8')

    const existing = await db.skill.findFirst({ where: { nom } })

    if (existing) {
      console.log(`Skill "${nom}" already exists, skipping`)
      continue
    }

    await db.skill.create({
      data: {
        nom,
        contenu,
        version: '1.0.0',
        plateforme,
        actif: true,
        updatedBy: 'seed',
      },
    })

    console.log(`Seeded skill: ${nom}`)
  }
}

// Run directly
if (require.main === module) {
  seedSkills()
    .then(() => {
      console.log('All skills seeded')
      process.exit(0)
    })
    .catch((err) => {
      console.error('Failed to seed skills:', err)
      process.exit(1)
    })
}
