# AGENT.md - StoryTailor Project Guidelines

## Build, Lint & Test Commands
- **Development server**: `npm run dev` (runs on port 9002)
- **Production build**: `npm run build`
- **Production start**: `npm run start`
- **Typecheck**: `npm run typecheck` (runs TypeScript without emitting files)
- **Lint**: `npm run lint` (runs Next.js linting)
- **Genkit development**: `npm run genkit:watch` (for AI flows development)

## Code Style Guidelines
- **Imports**: Absolute imports using `@/` path alias (e.g., `import { Component } from '@/components/Component'`)
- **Types**: Use TypeScript interfaces and types; strict mode is enabled
- **Error Handling**: Use try/catch with specific error logs and user-friendly messages
- **React Components**: Follow Next.js App Router patterns
- **Naming Conventions**: camelCase for variables/functions, PascalCase for components/interfaces
- **Function Pattern**: Server actions use "use server" directive at the top of file
- **Firebase**: Admin SDK for server-side operations, client SDK for client-side

## Tech Stack
- Next.js (App Router)
- TypeScript
- Tailwind CSS with ShadCN/UI components
- Firebase (Authentication, Firestore, Storage)
- Genkit for AI workflows