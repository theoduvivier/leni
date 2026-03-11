import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  // Persona Flipio
  const flipio = await db.persona.upsert({
    where: { slug: 'flipio' },
    update: {},
    create: {
      slug: 'flipio',
      nom: 'Flipio',
      config: {
        identite: {
          nom: 'Flipio',
          tagline: 'La plateforme des marchands de biens',
          url: 'app.flipio.immo',
          stade: 'bêta privée',
        },
        cible: {
          profils: ['marchands de biens', 'promoteurs', 'agents immo investisseurs'],
          douleurs: ['sourcing chronophage', 'analyse DVF manuelle', 'Excel pas scalable'],
          anti_cible: ['particuliers', 'agents transac classiques'],
        },
        ton: {
          style: 'direct, expert, légèrement provocateur',
          a_eviter: ['trop commercial', 'superlatifs vides', 'anglicismes inutiles'],
        },
      },
      regles: "Toujours mentionner le nombre de places restantes quand quelqu'un demande un accès. Ne jamais promettre des fonctionnalités non encore développées. Si quelqu'un est hostile ou sceptique, ne pas insister.",
      faq: [
        {
          question: "C'est quoi Flipio ?",
          reponse: "Une plateforme qui agrège DVF, DPE et données cadastrales pour que les marchands de biens sourcent et analysent des deals en minutes au lieu d'heures.",
        },
        {
          question: "C'est gratuit ?",
          reponse: "La bêta est gratuite avec accès complet. Ensuite abonnement mensuel — les bêta testeurs ont un tarif préférentiel à vie.",
        },
        {
          question: 'Ça marche comment ?',
          reponse: 'Tu rentres une adresse ou une zone, Flipio croise DVF normalisé + DPE + copropriété et te sort une fiche d\'analyse complète en 30 secondes.',
        },
      ],
      contextLive: {
        create: {
          data: {
            beta: {
              places_disponibles: 47,
              date_ouverture: '2025-04-01',
              avantages: ['accès lifetime deal', 'onboarding personnalisé', 'influence roadmap'],
              mot_trigger: 'FLIPIO',
              lien_inscription: 'app.flipio.immo/beta',
            },
          },
        },
      },
    },
  })

  // Persona MdB Perso
  const mdb = await db.persona.upsert({
    where: { slug: 'mdb' },
    update: {},
    create: {
      slug: 'mdb',
      nom: 'MdB Perso',
      config: {
        identite: {
          nom: 'Théo',
          activite: 'Marchand de biens — Paris & IDF',
        },
        operations: {
          strategies_actives: ['division appartements', 'bloc/détail', 'rénovation revente'],
          ticket_moyen: '300–800k€',
          zone_cible: ['Paris intramuros', 'Petite couronne', 'villes >50k hab IDF'],
        },
        criteres_deal: {
          immeuble: [
            'Minimum 4 lots',
            'Potentiel de division existant (surface >40m² par lot créable)',
            'Pas de copropriété problématique',
          ],
          appartement: [
            'Surface >60m² divisible',
            'Paris ou couronne avec tension locative forte',
          ],
        },
        ce_que_je_ne_fais_pas: ['Viager', 'Résidences services', 'Hors IDF pour l\'instant'],
        ton: {
          style: 'pragmatique, terrain, chiffres concrets, pas de blabla',
        },
      },
      regles: "Toujours parler en chiffres concrets. Ne jamais donner de conseils juridiques ou fiscaux précis. Si quelqu'un cherche un associé ou propose un deal, demander les détails (ville, surface, prix demandé, état) avant de donner un avis.",
      faq: [],
      contextLive: {
        create: {
          data: {},
        },
      },
    },
  })

  console.log('Seeded personas:', flipio.slug, mdb.slug)

  // Skills
  const skills = [
    {
      nom: 'linkedin_post_texte',
      plateforme: 'linkedin',
      contenu: `# Skill : linkedin_post_texte
# Version : 1.0.0

## Règles de format
- Longueur : 900–1100 caractères
- Hashtags : 0 à 3 maximum, intégrés naturellement
- Une idée = une ligne courte
- Emojis : 1–2 maximum si naturels

## Structure obligatoire
1. ACCROCHE (ligne 1) : contre-intuitive ou chiffre choc
2. CORPS : 6–9 lignes courtes, rythme punchy
3. CTA FINAL : une seule action demandée

## À éviter
- Superlatifs vides (révolutionnaire, incroyable...)
- Post qui commence par "Je"
- Plus de 2 phrases longues consécutives
- Jargon sans explication`,
    },
    {
      nom: 'linkedin_post_image',
      plateforme: 'linkedin',
      contenu: `# Skill : linkedin_post_image
# Version : 1.0.0

## Règles de format
- Texte accompagnant : 600–900 caractères (plus court qu'un post texte seul)
- L'image doit porter le message principal — le texte contextualise
- Hashtags : 0 à 2 maximum

## Structure obligatoire
1. ACCROCHE (ligne 1) : référence visuelle à l'image
2. CORPS : 4–6 lignes, complémentaire à l'image
3. CTA FINAL : une action ou question

## Consignes image
- Format recommandé : 1200x627px (paysage) ou 1080x1080 (carré)
- Texte sur image : lisible, max 7 mots
- Couleurs contrastées pour la lisibilité mobile`,
    },
    {
      nom: 'linkedin_comment_trigger',
      plateforme: 'linkedin',
      contenu: `# Skill : linkedin_comment_trigger
# Version : 1.0.0

## Principe
L'algorithme LinkedIn booste les posts avec beaucoup de commentaires.
Demander de commenter un mot-clé est du growth hacking natif.

## Structure obligatoire
1. ACCROCHE forte (1 ligne, parfois fausse polémique)
2. CORPS : 8–12 lignes, monter la tension progressive
3. PROMESSE : ce que reçoit la personne qui commente
4. CTA : "Commentez [MOT_CLÉ] et je vous envoie [LIVRABLE]"

## 3 variantes à toujours générer
- Polémique douce : commence par une affirmation forte et contestable
- Storytelling : commence par "J'ai..." avec une situation réelle
- Chiffre choc : commence par un nombre surprenant

## Score de viralité (0-10)
Évaluer chaque variante sur :
- Force de l'accroche (3 pts)
- Clarté de la promesse (3 pts)
- Urgence / FOMO (2 pts)
- Simplicité du CTA (2 pts)`,
    },
    {
      nom: 'linkedin_ghostwriter',
      plateforme: 'linkedin',
      contenu: `# Skill : linkedin_ghostwriter
# Version : 1.0.0

## Format
- Longueur : 1500–2200 caractères
- Post pédagogique long format
- Structure claire avec sauts de ligne aérés

## Structure obligatoire
1. ACCROCHE : affirmation forte ou question provocatrice
2. CONTEXTE : 2-3 lignes pour poser le sujet
3. CORPS : 5-7 points développés, chacun sur 1-2 lignes
4. LEÇON / TAKEAWAY : résumé actionnable
5. CTA : question ouverte pour engagement

## Sujets types
- Analyse d'un immeuble (chiffres réels)
- Erreurs fréquentes MdB débutant
- Impact DPE / réglementation
- Flipio vs outils classiques (Excel, etc.)
- Retour d'expérience terrain

## Ton
- Expert mais accessible
- Chiffres concrets obligatoires
- Pas de condescendance
- Autorité naturelle (expérience terrain)`,
    },
    {
      nom: 'instagram_caption',
      plateforme: 'instagram',
      contenu: `# Skill : instagram_caption
# Version : 1.0.0

## Format
- Longueur : 150–300 caractères pour la partie visible
- Structure : phrase d'accroche → 2-3 lignes → hashtags en fin
- Hashtags : 20–30, mix niche + populaires
- Emojis : utilisés librement, 1 par idée max

## Hashtags immo recommandés (à adapter)
#immobilier #investissementimmobilier #marchanddebiens
#immobilierfrancais #investir #patrimoine #paris #idf
#renovation #division #flipimmo

## Ton
Plus personnel et visuel que LinkedIn.
Parler à la première personne, montrer les coulisses.`,
    },
    {
      nom: 'instagram_story',
      plateforme: 'instagram',
      contenu: `# Skill : instagram_story
# Version : 1.0.0

## Format
- Image verticale 1080x1920px
- Texte overlay : max 3 lignes, gros, lisible
- Fond : photo flouttée ou couleur unie
- Durée attention : 3 secondes max

## Structure
1. TITRE CHOC : 3-5 mots max, gros
2. SOUS-TITRE : 1 ligne contextuelle
3. CTA : swipe up / lien / DM

## Consignes Sharp.js
- Police : bold, sans-serif
- Taille titre : 64px minimum
- Couleur texte : blanc avec ombre portée
- Zone de texte : centrée verticalement, padding 80px côtés`,
    },
    {
      nom: 'deal_case_study',
      plateforme: 'linkedin',
      contenu: `# Skill : deal_case_study
# Version : 1.0.0

## Rôle
Rédiger un post LinkedIn narratif à partir d'un deal immobilier terminé.

## Format
- 1200-1800 caractères, retour d'expérience terrain
- Structure : accroche chiffrée → contexte → stratégie → résultats → leçon → CTA

## Règles
- Toujours mentionner la ville et le chiffre clé
- Ne pas inventer de détails non fournis
- Adapter le ton au persona (Flipio = angle outil, MdB = angle terrain)`,
    },
    {
      nom: 'comment_reply',
      plateforme: 'all',
      contenu: `# Skill : comment_reply
# Version : 1.0.0

## Rôle
Analyser un commentaire LinkedIn et rédiger une réponse adaptée.
Objectif : engager la conversation (boost algo) et nurturer les prospects.

## Classification
- QUESTION : vraie question → réponse détaillée, experte
- PROSPECT : intérêt pour Flipio ou deal MdB → réponse chaleureuse + CTA soft
- COMPLIMENT : valide le contenu → remerciement court + relance
- DEBAT : challenge ou contredit → argumenté, jamais agressif
- SPAM : non pertinent → ne pas répondre (null)

## Règles
- Maximum 3 phrases
- Utiliser le prénom de l'auteur
- Terminer par une question ouverte si naturel
- Adapter le ton au persona (Flipio = expert tech, MdB = terrain)

## Format de sortie
JSON : { "classification": "question|prospect|compliment|debat|spam", "isQuestion": true/false, "isProspect": true/false, "reply": "string|null", "shouldDM": true/false }`,
    },
  ]

  for (const skill of skills) {
    await db.skill.upsert({
      where: { nom: skill.nom },
      update: { contenu: skill.contenu },
      create: {
        nom: skill.nom,
        contenu: skill.contenu,
        version: '1.0.0',
        plateforme: skill.plateforme,
        updatedBy: 'seed',
      },
    })
  }

  console.log('Seeded skills:', skills.map((s) => s.nom).join(', '))
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await db.$disconnect()
    process.exit(1)
  })
