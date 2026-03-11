# Leni — Agent Social Media piloté par Claude

## Vision

Leni est un agent de présence en ligne qui tourne 24h/24 sur un VPS.
Il gère deux personas (Flipio et MdB perso), génère du contenu LinkedIn/Instagram,
publie automatiquement, et surveille les commentaires.

Deux modes :
- **Pilote automatique** : génération, publication sans intervention
- **Mode assisté** : tu fournis un brief ou un media, tu valides, l'agent publie

## Stack

- **Frontend** : Next.js 14 App Router — dashboard de contrôle (port 3000)
- **Worker** : Node.js + TypeScript — agents, crons, publishers (port 3001)
- **Queue** : DB polling (Job table + setInterval 10s)
- **ORM** : Prisma + PostgreSQL
- **IA** : Claude API — modèle `claude-sonnet-4-20250514`
- **Media** : Sharp.js (traitement images, overlay texte stories)
- **Photos stock** : Pexels API (gratuit)
- **Infra** : VPS Hostinger / Dokploy — PostgreSQL service dédié

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
│       │   ├── agents/       (content-agent, viral-agent, comment-agent)
│       │   ├── publishers/   (linkedin.ts, instagram.ts)
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

### M03 — Carnet de Deal (Core)
Upload photos avant/après + 3 infos → case study LinkedIn + carrousel Instagram.
- Input : photos, ville, stratégie, chiffre clé (plus-value ou rendement)
- Output : post narratif LinkedIn + carrousel Sharp.js Instagram

### M04 — Ghostwriter LinkedIn (Core)
Posts pédagogiques longs format sur les sujets maîtrisés.
- Sujets types : analyse immeuble, erreurs MdB débutant, impact DPE, Flipio vs Excel
- Format : accroche forte + corps listes courtes + CTA adapté au persona

### M05 — Calendrier Éditorial (Core)
Planification cohérente sur 7 jours. Alterne formats, respecte best practices horaires,
détecte les trous et propose de les combler.

### M07 — Réponse Commentaires (Core)
Récupère les commentaires LinkedIn à la demande. Claude génère une réponse pour chaque commentaire.
- Bouton "Récupérer commentaires" sur la page Posts
- Bouton "Générer réponse" par commentaire → Claude rédige
- Publier la réponse sur LinkedIn via API

### M09 — Viral On-Demand (Core)
Brief express → 3 variantes de post "comment trigger" avec score viralité estimé.
- Mécanisme : demander de commenter un mot-clé booste l'algo LinkedIn
- Output : 3 variantes (polémique / storytelling / chiffre choc) + template DM réponse

### M11 — Context Engine (Core)
Mémoire centrale injectée dans chaque prompt Claude.
- Stockage : DB via Prisma
- Données live : places bêta restantes, date ouverture, promos en cours
- Règles de réponse en langage naturel
- FAQ / objections par persona
- Mise à jour depuis le dashboard

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
- `deal_case_study.md`
- `comment_reply.md`

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
  comments    Comment[]
}

model Comment {
  id             String   @id @default(cuid())
  postId         String
  post           Post     @relation(fields: [postId], references: [id])
  externalId     String   @unique
  authorName     String
  authorHeadline String?
  contenu        String
  isQuestion     Boolean  @default(false)
  isProspect     Boolean  @default(false)
  draftReply     String?
  statut         String   @default("pending")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([postId])
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

## Job Types

```
content-generation   → générer un post
publish-linkedin     → publier sur LinkedIn
publish-instagram    → publier sur Instagram
comment-poll         → récupérer les commentaires LinkedIn
comment-reply        → répondre à un commentaire
```

## Crons

```
(aucun cron actif — toutes les actions sont déclenchées manuellement)
```

## Variables d'environnement

```
DATABASE_URL
ANTHROPIC_API_KEY
LINKEDIN_CLIENT_ID
LINKEDIN_CLIENT_SECRET
LINKEDIN_ACCESS_TOKEN
META_APP_ID
META_APP_SECRET
INSTAGRAM_BUSINESS_ACCOUNT_ID
INSTAGRAM_ACCESS_TOKEN
PEXELS_API_KEY
NEXTAUTH_SECRET
NEXTAUTH_URL
ENCRYPTION_KEY
```

## Auth

NextAuth.js, provider Credentials (usage solo). Toutes les routes API protégées.
Tokens OAuth LinkedIn/Meta chiffrés AES-256 en DB.

## UI / Design

- Glassmorphisme dark, mobile-first, optimisé PWA
- Fond `#eef2ff`, accent `#3b6fff`, teal `#00c4a7`, pink `#ff6b9d`
- Typo : Bricolage Grotesque (titres) + Instrument Sans (corps)
- Composants 100% custom Tailwind — aucune lib externe
- Bottom nav avec FAB central pour composer
- 4 onglets : Accueil / Calendrier / Posts / Contexte

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
