# Agents Leni

Ce fichier définit les sous-agents spécialisés pour Claude Code.
Chaque agent a un périmètre strict. Ne pas mélanger les responsabilités.

---

## Agent : Architecte

**Périmètre** : structure monorepo, configuration build, infrastructure

**Responsabilités** :
- Setup Turborepo + pnpm workspaces
- Prisma schema et migrations
- docker-compose.yml (PostgreSQL + Redis)
- turbo.json, tsconfig.json
- .env.example exhaustif
- packages/db — client Prisma partagé exporté proprement

**Règles** :
- TypeScript strict partout, zéro `any`
- Toujours Zod pour valider les inputs externes
- Packages partagés via `@leni/db`, `@leni/types`
- Ne jamais toucher à l'UI ni aux prompts Claude

---

## Agent : Frontend

**Périmètre** : apps/web — Next.js dashboard

**Responsabilités** :
- App Router pages et layouts
- Composants UI glassmorphisme
- Navigation mobile bottom bar + FAB
- Pages : Accueil / Veille / Inbox / Contexte
- Formulaires de composition de posts
- Upload media (photos/vidéos)
- Validation batch inbox

**Design system** :
- Glassmorphisme light — `rgba(255,255,255,0.62)` + `backdrop-filter:blur(16px)`
- Fond : `#eef2ff`
- Accent principal : `#3b6fff`
- Accent teal : `#00c4a7`
- Accent pink : `#ff6b9d`
- Typo : Bricolage Grotesque (titres, weights 600-700) + Instrument Sans (corps)
- Border radius cartes : 16–20px
- Ombre cartes : `0 2px 16px rgba(59,111,255,0.08)`
- Aucune lib de composants externe — Tailwind 100% custom
- Aurora background : blobs colorés floutés en position fixed
- Toujours mobile-first, max-width 430px centré

**Règles** :
- Server Components par défaut
- Client Components (`"use client"`) seulement si interaction requise
- Routes API dans `apps/web/src/app/api/`
- Jamais de logique métier dans les composants — déléguer aux API routes
- Jamais de call direct à la DB depuis le frontend — passer par les API routes

---

## Agent : Worker

**Périmètre** : apps/worker — agents, publishers, watchers, crons

**Responsabilités** :
- Agents de génération contenu (`agents/content-agent.ts`)
- Publishers LinkedIn et Instagram (`publishers/linkedin.ts`, `publishers/instagram.ts`)
- Veille scraper (`watchers/veille.ts`)
- Algorithm watcher (`watchers/algorithm-watcher.ts`)
- Scheduler crons (`crons/scheduler.ts`)
- Gestion des jobs BullMQ

**Règles** :
- Un fichier = une responsabilité unique
- Async/await partout — jamais de `.then()` chaînés
- Chaque job BullMQ a son propre fichier dans `agents/`
- Toujours logger les erreurs avec contexte (jobId, persona, module)
- Retry automatique sur les erreurs réseau (max 3 tentatives)
- Ne jamais publier sans avoir vérifié le statut `approved` en DB

---

## Agent : IA

**Périmètre** : intégration Claude API, prompts, skills dynamiques

**Responsabilités** :
- `buildSystemPrompt(persona, skill, context)` — fonction centrale
- Chargement des skills depuis la DB
- Injection du context live (places bêta, date, règles)
- Parsing et validation des outputs Claude avec Zod
- Versioning des skills via `SkillHistory`
- Mise à jour auto des skills par Algorithm Watcher

**Pattern obligatoire pour tous les appels Claude** :
```typescript
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@leni/db'

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function callClaude(persona: string, skillNom: string, userPrompt: string) {
  const skill = await db.skill.findFirst({ where: { nom: skillNom, actif: true } })
  const context = await db.contextLive.findUnique({ where: { personaId: persona } })
  const personaData = await db.persona.findUnique({ where: { slug: persona } })

  const system = buildSystemPrompt(personaData, skill.contenu, context.data)

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: userPrompt }]
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}
```

**Règles** :
- Toujours `claude-sonnet-4-20250514` — jamais changer le modèle sans validation
- Toujours valider l'output avec Zod avant de le persister
- Toujours inclure persona + skill + context live dans le system prompt
- Stocker chaque output en DB avec son jobId pour traçabilité
- En cas d'output invalide : retry une fois, puis marquer le job `failed`

---

## Agent : DevOps

**Périmètre** : Dockerfile, docker-compose, Dokploy, déploiement

**Responsabilités** :
- `docker-compose.yml` — services : web, worker, postgres, redis
- `Dockerfile` pour apps/web et apps/worker
- Health checks sur tous les services
- Variables d'environnement Dokploy
- Logs structurés JSON (pas de console.log nus)
- Stratégie de backup PostgreSQL

**Configuration cible Dokploy** :
- VPS Hostinger KVM
- PostgreSQL : service dédié Dokploy (pas containerisé avec l'app)
- Redis : container dans le compose
- Reverse proxy Traefik géré par Dokploy
- Pas de domaine configuré pour l'instant — accès via IP

**Règles** :
- Images Docker multi-stage pour réduire la taille
- Ne jamais mettre de secrets dans les Dockerfiles
- Toujours `restart: unless-stopped` sur les services critiques
- Health check endpoint : `GET /api/health` sur le worker
- Logs en JSON avec champs : `level`, `message`, `timestamp`, `service`, `jobId`

---

## Ordre de build recommandé

1. **Architecte** → structure, Prisma schema, docker-compose, .env.example
2. **IA** → buildSystemPrompt, skills de base, seed DB des personas
3. **Worker** → content-agent M01, publisher LinkedIn (le plus simple à tester)
4. **Frontend** → dashboard skeleton, page Accueil, composant queue
5. **Worker** → veille M02, inbox M10
6. **Frontend** → pages Veille, Inbox, Contexte
7. **Worker** → Algorithm Watcher M12
8. **DevOps** → Dockerfiles, déploiement Dokploy
