# Refactoring Plan for src/app/(app)/assemble-video/page.tsx

This document outlines the plan to refactor the `src/app/(app)/assemble-video/page.tsx` file into smaller, more manageable components to improve code organization and maintainability.

## Phase 1: Setup and Utility Consolidation

1.  **Create Components Directory:**
    *   Create the directory: `src/app/(app)/assemble-video/components/`
    *   This directory will house all new UI components extracted from or created for the `assemble-video` page.

2.  **Consolidate Utility Function Usage:**
    *   The functions `parseNamedPrompts()` and `parseEntityReferences()` are already present in `src/app/(app)/assemble-video/utils.ts`.
    *   Remove the duplicate definitions of `parseNamedPrompts()` (lines 721-777) and `parseEntityReferences()` (lines 1607-1691) from `src/app/(app)/assemble-video/page.tsx`.
    *   Ensure that `src/app/(app)/assemble-video/page.tsx` and any components that use these functions (e.g., `CharactersPanelContent` for `parseNamedPrompts`) import them correctly from `src/app/(app)/assemble-video/utils.ts`.

## Phase 2: Extracting Existing Panel Components

For each component listed below, the general process will be:
    a. Create a new `.tsx` file within the `src/app/(app)/assemble-video/components/` directory (e.g., `StoryContent.tsx`).
    b. Transfer the component's function definition, props, internal state, JSX, and any directly related logic (like helper functions or effects scoped to that component) into the new file.
    c. Ensure all necessary imports (React, hooks, UI elements from `@/components/ui`, types, actions, utility functions from `../utils.ts`, etc.) are correctly added to the new component file.
    d. Export the component from its new file.
    e. In `src/app/(app)/assemble-video/page.tsx`, import the newly created component and replace the original inline code with the imported component, passing all required props.

3.  **Extract `StoryContent` Component:**
    *   Identified in `page.tsx` at lines 87-622.
    *   New file: `src/app/(app)/assemble-video/components/StoryContent.tsx`

4.  **Extract `VoicesContent` Component:**
    *   Identified in `page.tsx` at lines 625-712.
    *   New file: `src/app/(app)/assemble-video/components/VoicesContent.tsx`

5.  **Extract `AllMediaContent` Component:**
    *   Identified in `page.tsx` at lines 781-887.
    *   New file: `src/app/(app)/assemble-video/components/AllMediaContent.tsx`

6.  **Extract `CharactersPanelContent` Component:**
    *   Identified in `page.tsx` at lines 912-1448.
    *   This component already uses `parseNamedPrompts()`. Ensure it imports this from `../utils.ts` after extraction.
    *   New file: `src/app/(app)/assemble-video/components/CharactersPanelContent.tsx`

7.  **Extract `EditTimelineItemPanelContent` Component:**
    *   Identified in `page.tsx` at lines 1451-1569.
    *   New file: `src/app/(app)/assemble-video/components/EditTimelineItemPanelContent.tsx`

## Phase 3: Creating New Layout Components

Similar to Phase 2, for each new layout component:
    a. Create its `.tsx` file in `src/app/(app)/assemble-video/components/`.
    b. Define the component, including its props and JSX, by extracting the relevant sections from the current layout in `page.tsx`.
    c. Add imports and export the component.
    d. Integrate it into the main `page.tsx`.

8.  **Create `VideoPageSidebar` Component:**
    *   To manage the left sidebar (currently lines 2341-2394 in `page.tsx`).
    *   Props will likely include `selectedPanel`, `setSelectedPanel`, `isSidebarOpen`, `setIsSidebarOpen`, `storyId`, and `sidebarNavItems`.
    *   New file: `src/app/(app)/assemble-video/components/VideoPageSidebar.tsx`

9.  **Create `VideoPreviewArea` Component:**
    *   To display the central video/image preview (currently lines 2472-2516 in `page.tsx`).
    *   Props: `storyData`, `selectedTimelineImage`.
    *   New file: `src/app/(app)/assemble-video/components/VideoPreviewArea.tsx`

10. **Create `VideoControls` Component:**
    *   To encapsulate video playback/action controls (currently lines 2518-2559 in `page.tsx`).
    *   Props: `storyData`.
    *   New file: `src/app/(app)/assemble-video/components/VideoControls.tsx`

11. **Create `TimelineStrip` Component:**
    *   To manage the image timeline strip at the bottom (currently lines 2561-2650 in `page.tsx`).
    *   Props: `storyData`, `selectedTimelineImage`, `setSelectedTimelineImage`, `setSelectedPanel`, `isGeneratingImages`, `handleGenerateChapterImages`, `currentChapter`, `chaptersGenerated`, `currentImageProgress`, `totalImagesToGenerate`, `generationProgress`.
    *   New file: `src/app/(app)/assemble-video/components/TimelineStrip.tsx`

## Phase 4: Refactor Main Page Component

12. **Update `AssembleVideoPage` in `src/app/(app)/assemble-video/page.tsx`:**
    *   The main `AssembleVideoPage` component will be refactored to import and use all the newly created/extracted components.
    *   It will primarily handle overall page structure, state management (lifting state where necessary), and passing props and event handlers to its child components.
    *   The goal is to make this main component significantly leaner and focused on orchestration.

## Testing Strategy
We will proceed step-by-step. After each significant extraction or creation, we should verify that the application still functions as expected.