# Leni — Agent Social Media piloté par Claude

## Vision

Leni est un agent de présence en ligne qui tourne 24h/24 sur un VPS.
Il gère deux personas (Flipio et MdB perso), génère du contenu LinkedIn/Instagram,
publie automatiquement, répond aux messages, et s'améliore seul en suivant les algorithmes.

Deux modes :
- **Pilote automatique** : veille, génération, publication sans intervention
- **Mode assisté** : tu fournis un brief ou un media, tu valides, l'agent publie

## Stack

- **Frontend** : Next.js 14 App Router — dashboard de contrôle (port 3000)
- **Worker** : Node.js + TypeScript — agents, crons, publishers (port 3001)
- **Queue** : BullMQ + Redis
- **ORM** : Prisma + PostgreSQL
- **IA** : Claude API — modèle `claude-sonnet-4-20250514`
- **Media** : Sharp.js (traitement images, overlay texte stories)
- **Photos stock** : Pexels API (gratuit)
- **Email** : Brevo API (gratuit jusqu'à 300/jour)
- **Infra** : VPS Hostinger / Dokploy — PostgreSQL service dédié + Redis

## Structure monorepo

```
leni/
├── CLAUDE.md
├── AGENTS.md
├── SPEC.md
├── package.json              (pnpm workspaces + Turborepo)
├── turbo.json
├── docker-compose.yml
├── .env.example
├── apps/
│   ├── web/                  (Next.js dashboard)
│   │   ├── src/
│   │   │   ├── app/          (App Router pages)
│   │   │   ├── components/   (UI components)
│   │   │   └── lib/          (utils, hooks)
│   │   └── package.json
│   └── worker/               (Agent Node.js)
│       ├── src/
│       │   ├── agents/       (content-agent, watch-agent, inbox-agent)
│       │   ├── publishers/   (linkedin.ts, instagram.ts)
│       │   ├── watchers/     (algorithm-watcher.ts, veille.ts)
│       │   ├── crons/        (scheduler.ts)
│       │   └── skills/       (fichiers .md des skills dynamiques)
│       └── package.json
└── packages/
    └── db/                   (Prisma schema + client partagé)
        ├── prisma/
        │   └── schema.prisma
        └── package.json
```

## Conventions de code

- TypeScript strict partout — zéro `any`
- Nommage : camelCase vars/fonctions, PascalCase composants/types, kebab-case fichiers
- Imports absolus (`@/components/...`, `@leni/db`)
- Async/await partout — jamais de `.then()` chaînés
- Un fichier = une responsabilité
- Zod pour valider toutes les entrées externes

## Personas

### Flipio (`persona: "flipio"`)
- B2B SaaS pour marchands de biens — app.flipio.immo
- Cible : marchands de biens, promoteurs, investisseurs pro
- Anti-cible : particuliers, agents transac classiques
- Ton : direct, expert, légèrement provocateur
- Douleurs clients : sourcing chronophage, analyse DVF manuelle, Excel pas scalable
- Stade actuel : bêta privée

### MdB Perso (`persona: "mdb"`)
- Activité personnelle de marchand de biens — Paris & IDF
- Stratégies actives : division d'appartements, bloc/détail, rénovation-revente
- Ticket moyen : 300–800k€
- Zones : Paris intramuros, petite couronne, villes >50k hab IDF
- Ton : pragmatique, terrain, chiffres concrets, pas de blabla

## Modules

### M01 — Content Agent (Core)
Génère et publie des posts LinkedIn et Instagram.
- Input : brief texte, photo/vidéo uploadée, ou déclencheur automatique
- Output : post LinkedIn (texte ± image), caption Instagram + hashtags, Story verticale
- Utilise : Pexels API si aucun media fourni, Sharp.js pour Story

### M02 — Veille & Trending (Core)
Scrape quotidiennement les sources immo, Claude score et sélectionne.
- Sources : RSS (SeLoger, PAP, FNAIM, Le Moniteur, MeilleursAgents), Légifrance RSS, Reddit r/immobilier r/investissement
- Cron : 6h quotidien
- Score Claude 0–10 : >7 → queue auto, 5–7 → digest manuel, <5 → ignoré

### M03 — Carnet de Deal (Core)
Upload photos avant/après + 3 infos → case study LinkedIn + carrousel Instagram.
- Input : photos, ville, stratégie, chiffre clé (plus-value ou rendement)
- Output : post narratif LinkedIn + carrousel Sharp.js Instagram

### M04 — Ghostwriter LinkedIn (Core)
Posts pédagogiques longs format sur les sujets maîtrisés.
- Sujets types : analyse immeuble, erreurs MdB débutant, impact DPE, Flipio vs Excel
- Format : accroche forte + corps listes courtes + CTA adapté au persona

### M05 — Calendrier Éditorial (V2)
Planification cohérente sur 7 jours. Alterne formats, respecte best practices horaires,
détecte les trous et propose de les combler.

### M06 — Newsletter Hebdo (V2)
Résumé veille semaine rédigé par Claude dans la voix du persona.
Envoi via Brevo. Contenu recyclé depuis les posts LinkedIn.

### M07 — Réponse Commentaires (V2)
Polling commentaires LinkedIn. Claude rédige les réponses aux questions techniques.
Prospects Flipio → draft DM nurturing.

### M08 — Brand Monitoring (V3)
Google Alerts webhook. Surveille mentions "Flipio" et nom perso.
Alerte email si réaction nécessaire.

### M09 — Viral On-Demand (Core)
Brief express → 3 variantes de post "comment trigger" avec score viralité estimé.
- Mécanisme : demander de commenter un mot-clé booste l'algo LinkedIn
- Output : 3 variantes (polémique / storytelling / chiffre choc) + template DM réponse

### M10 — Inbox Manager (Core)
Lit messages LinkedIn entrants, classifie, rédige les réponses. Validation batch.
- Classification : Prospect Flipio / Deal MdB / Networking / Spam / Perso
- Implémentation : extension Chrome custom → backend VPS
- Dashboard batch : cocher/ajuster/envoyer en une action

### M11 — Context Engine (Core)
Mémoire centrale injectée dans chaque prompt Claude.
- Stockage : DB via Prisma
- Données live : places bêta restantes, date ouverture, promos en cours
- Règles de réponse en langage naturel
- FAQ / objections par persona
- Mise à jour depuis le dashboard

### M12 — Algorithm Watcher (Core)
Cron hebdo (lundi 8h). Scrape sources algo LinkedIn/Instagram.
Met à jour les skills dynamiques automatiquement.
- Sources : blog officiel LinkedIn/Meta, Richard van der Blom, Justin Welsh, Later Blog, Adam Mosseri
- Niveaux de confiance : haute (auto) / moyenne (validation) / faible (surveillance)
- Skills versionnés avec rollback possible

## Skills Dynamiques

Chaque skill = fichier Markdown versionné en DB, injecté dans chaque appel Claude.

```typescript
const skill = await db.skill.findFirst({ where: { nom, actif: true } })
const system = buildSystemPrompt(persona, skill.contenu, liveContext)
const response = await claude.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  system,
  messages: [{ role: 'user', content: prompt }]
})
```

Skills initiaux dans `apps/worker/src/skills/` :
- `linkedin_post_texte.md`
- `linkedin_post_image.md`
- `linkedin_comment_trigger.md`
- `linkedin_ghostwriter.md`
- `instagram_caption.md`
- `instagram_story.md`
- `inbox_reply.md`
- `veille_scoring.md`

## Schema Prisma

```prisma
model Persona {
  id          String       @id @default(cuid())
  slug        String       @unique
  nom         String
  config      Json
  regles      String
  faq         Json
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  posts       Post[]
  contextLive ContextLive?
}

model ContextLive {
  id        String   @id @default(cuid())
  personaId String   @unique
  persona   Persona  @relation(fields: [personaId], references: [id])
  data      Json
  updatedAt DateTime @updatedAt
}

model Skill {
  id         String         @id @default(cuid())
  nom        String
  contenu    String
  version    String
  plateforme String
  actif      Boolean        @default(true)
  updatedBy  String
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt
  history    SkillHistory[]
}

model SkillHistory {
  id        String   @id @default(cuid())
  skillId   String
  skill     Skill    @relation(fields: [skillId], references: [id])
  contenu   String
  version   String
  createdAt DateTime @default(now())
}

model Post {
  id          String    @id @default(cuid())
  personaId   String
  persona     Persona   @relation(fields: [personaId], references: [id])
  type        String
  module      String
  contenu     String
  mediaUrl    String?
  statut      String
  publishAt   DateTime?
  publishedAt DateTime?
  platform    String
  externalId  String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model VeilleItem {
  id        String   @id @default(cuid())
  source    String
  titre     String
  url       String
  contenu   String?
  score     Int
  persona   String
  statut    String
  createdAt DateTime @default(now())
}

model InboxMessage {
  id           String   @id @default(cuid())
  platform     String
  externalId   String   @unique
  senderName   String
  senderRole   String?
  contenu      String
  categorie    String?
  draftReponse String?
  statut       String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model AlgoRule {
  id         String   @id @default(cuid())
  plateforme String
  regle      String
  valeur     String
  source     String
  confiance  String
  actif      Boolean  @default(true)
  createdAt  DateTime @default(now())
}

model Media {
  id        String   @id @default(cuid())
  filename  String
  path      String
  type      String
  size      Int
  postId    String?
  createdAt DateTime @default(now())
}
```

## Queues BullMQ

```
content-generation   → générer un post
publish-linkedin     → publier sur LinkedIn
publish-instagram    → publier sur Instagram
veille-scrape        → scraper les sources
inbox-poll           → récupérer les messages
algo-watch           → analyser les algos plateforme
```

## Crons

```
06:00  quotidien  → veille-scrape
19:00  quotidien  → inbox-poll
08:00  lundi      → algo-watch
08:30  lundi      → digest email hebdo
```

## Variables d'environnement

```
DATABASE_URL
REDIS_URL
ANTHROPIC_API_KEY
LINKEDIN_CLIENT_ID
LINKEDIN_CLIENT_SECRET
LINKEDIN_ACCESS_TOKEN
META_APP_ID
META_APP_SECRET
INSTAGRAM_BUSINESS_ACCOUNT_ID
INSTAGRAM_ACCESS_TOKEN
PEXELS_API_KEY
BREVO_API_KEY
NEXTAUTH_SECRET
NEXTAUTH_URL
ENCRYPTION_KEY
```

## Auth

NextAuth.js, provider Credentials (usage solo). Toutes les routes API protégées.
Tokens OAuth LinkedIn/Meta chiffrés AES-256 en DB.

## UI / Design

- Glassmorphisme light, mobile-first, optimisé PWA
- Fond `#eef2ff`, accent `#3b6fff`, teal `#00c4a7`, pink `#ff6b9d`
- Typo : Bricolage Grotesque (titres) + Instrument Sans (corps)
- Composants 100% custom Tailwind — aucune lib externe
- Bottom nav avec FAB central pour composer
- 4 onglets : Accueil / Veille / Inbox / Contexte

## Règles absolues

- Jamais de posting sans validation humaine sur les posts à fort enjeu
- Pas d'automatisation agressive LinkedIn (risque ban)
- Pas de scraping Instagram direct — Graph API uniquement
- Secrets toujours dans les variables d'env, jamais dans le code

## Démarrage

```bash
pnpm install
pnpm db:migrate
pnpm dev
```
