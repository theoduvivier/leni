interface PersonaData {
  slug: string
  nom: string
  config: Record<string, unknown>
  regles: string
  faq: Array<{ question: string; reponse: string }>
}

export function buildSystemPrompt(
  persona: PersonaData,
  skillContent: string,
  liveData: Record<string, unknown>,
  platform?: string
): string {
  const faqBlock = persona.faq.length > 0
    ? `\n\n## FAQ\n${persona.faq.map((f) => `Q: ${f.question}\nR: ${f.reponse}`).join('\n\n')}`
    : ''

  const liveBlock = Object.keys(liveData).length > 0
    ? `\n\n## Données live\n${JSON.stringify(liveData, null, 2)}`
    : ''

  const platformName = platform === 'linkedin' ? 'LinkedIn'
    : platform === 'instagram' ? 'Instagram'
    : 'les réseaux sociaux'

  return `Tu es l'agent de communication pour ${persona.nom}.

## Persona
${JSON.stringify(persona.config, null, 2)}

## Règles
${persona.regles}${faqBlock}${liveBlock}

## Skill actif
${skillContent}

## Instructions de format
- Respecte strictement le format défini dans le skill
- Adapte le ton au persona
- Ne sors jamais du périmètre défini
- Réponds en français

## IMPORTANT — Format de sortie
- Retourne UNIQUEMENT le contenu du post, prêt à copier-coller tel quel
- JAMAIS de préambule ("Voici le post :", "Voilà une proposition :", etc.)
- JAMAIS de formatage Markdown (pas de #, ##, **, \`, etc.) sauf si le skill le demande explicitement (ex: JSON)
- JAMAIS de commentaires ou notes entre crochets [comme ceci]
- JAMAIS de signature, de séparateur "---", ou de métadonnées
- Le texte doit pouvoir être publié directement sur ${platformName} sans aucune modification`
}
