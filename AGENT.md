# AGENT.md - StoryTailor Project Guidelines

## Build, Lint & Test Commands
- **Development server**: `npm run dev` (runs on port 9002)
- **Production build**: `npm run build`
- **Production start**: `npm run start`
- **Typecheck**: `npm run typecheck` (runs TypeScript without emitting files)
- **Lint**: `npm run lint` (runs Next.js linting)
- **Genkit development**: `npm run genkit:watch` (for AI flows development)
- **Baserow testing**: `npm run test:baserow` or `npm run test:baserow-auth`
- **Video rendering**: `npm run remotion:render` (fast: `remotion:render:fast`)

## Architecture & Structure
- **Frontend**: Next.js App Router in `src/app/` with pages and API routes
- **Components**: Reusable UI in `src/components/` (ShadCN/UI based)
- **Actions**: Server actions in `src/actions/` for backend operations
- **AI Flows**: Genkit AI workflows in `src/ai/` for story generation
- **Database**: Firebase Firestore with Baserow as secondary storage
- **Video**: Remotion for video generation, FFmpeg for processing
- **Storage**: Firebase Storage for media files, MinIO for object storage

## Code Style Guidelines
- **Imports**: Absolute imports using `@/` path alias (e.g., `import { Component } from '@/components/Component'`)
- **Types**: Use TypeScript interfaces and types; strict mode is enabled
- **Error Handling**: Use try/catch with specific error logs and user-friendly messages
- **React Components**: Follow Next.js App Router patterns
- **Naming Conventions**: camelCase for variables/functions, PascalCase for components/interfaces
- **Function Pattern**: Server actions use "use server" directive at the top of file
- **Firebase**: Admin SDK for server-side operations, client SDK for client-side