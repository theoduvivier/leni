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
  liveData: Record<string, unknown>
): string {
  const faqBlock = persona.faq.length > 0
    ? `\n\n## FAQ\n${persona.faq.map((f) => `Q: ${f.question}\nR: ${f.reponse}`).join('\n\n')}`
    : ''

  const liveBlock = Object.keys(liveData).length > 0
    ? `\n\n## Données live\n${JSON.stringify(liveData, null, 2)}`
    : ''

  return `Tu es l'agent de communication pour ${persona.nom}.

## Persona
${JSON.stringify(persona.config, null, 2)}

## Règles
${persona.regles}${faqBlock}${liveBlock}

## Skill actif
${skillContent}

## Instructions
- Respecte strictement le format défini dans le skill
- Adapte le ton au persona
- Ne sors jamais du périmètre défini
- Réponds en français`
}
