# Refined Integration Plan: `StoryTailor` and `react-video-editor`

## 1. Goal

To integrate the `react-video-editor` (a Remotion-based video editing interface) into `StoryTailor`, enabling users to visually create and refine videos from AI-generated story content.

## 2. Project Analysis Summary

### `StoryTailor` (Main Project)

*   **Framework:** Next.js 15 (with React Server Components).
*   **UI:** shadcn/ui (default style, neutral base color) with Tailwind CSS. Uses `components.json`.
*   **State Management:** `@tanstack/react-query` for server state (Firebase), React Context/component state for local UI.
*   **Core Functionality:** AI-powered story generation (Genkit), script/narration/image prompt generation. Data stored in Firebase.
*   **Video Goal:** Intends to generate videos, evidenced by the `remotion-captions` (aka `react-video-editor`) dependency in `package.json`.

### `react-video-editor` (alias `remotion-captions`)

*   **Framework:** React (Vite-based, no RSC by default).
*   **Video Engine:** **Remotion** (React-based programmatic video creation).
*   **UI:** shadcn/ui (new-york style, zinc base color) with Tailwind CSS. Uses `components.json`.
*   **State Management:** **Zustand** (multiple feature-sliced stores like `use-store`, `use-layout-store`).
*   **Core Structure:** Main `Editor` component (`src/features/editor/editor.tsx`) orchestrating `Player`, `Timeline`, `Scene` management built around Remotion. Uses `@designcombo/*` packages.
*   **Entry Point:** `src/app.tsx` initializes some global data (fonts) and renders the `Editor`.

### Key Compatibility & Integration Points

*   **UI Stack:** Highly compatible (both shadcn/ui + Tailwind CSS). Minor style differences are manageable.
*   **Existing Link:** `StoryTailor/package.json` includes `"remotion-captions": "file:../react-video-editor"`. No code usage found yet, suggesting integration is planned but not implemented.
*   **Video Paradigm:** `StoryTailor` will adopt a Remotion-based video workflow. Story elements need to be translated into Remotion props/compositions.

## 3. Refined Integration Plan (Phased Approach)

### Phase 1: Basic Embedding and Initialization

1.  **Establish Local Package Link:**
    *   Verify `file:../react-video-editor` path in `StoryTailor/package.json`.
    *   Run `npm install` (or equivalent) in `StoryTailor` to link the local dependency.
    *   Address potential transpilation needs for `react-video-editor` within `StoryTailor`'s Next.js build (e.g., `next.config.js` `transpilePackages`).

2.  **Create Wrapper Component in `StoryTailor`:**
    *   Develop `StoryTailor/src/components/VideoEditorComponent.tsx`. Mark with `"use client";`.
    *   Import the main `Editor` component from `remotion-captions` (e.g., `remotion-captions/src/features/editor/editor`).
    *   Handle initial setup (like font loading from `react-video-editor`'s `app.tsx`) within this wrapper.
        ```typescript
        // StoryTailor/src/components/VideoEditorComponent.tsx (Conceptual)
        "use client";
        import React, { useEffect } from 'react';
        import Editor from 'remotion-captions/src/features/editor/editor';
        // Import necessary store hooks and data for initialization if needed
        // import useDataState from 'remotion-captions/src/features/editor/store/use-data-state';
        // import { FONTS, getCompactFontData } from 'remotion-captions/src/features/editor/data';

        const VideoEditorComponent = ({ initialVideoData }) => {
          // useEffect(() => {
          //   // Initialize editor-specific global state if not handled by props
          //   // const { setCompactFonts, setFonts } = useDataState.getState();
          //   // setCompactFonts(getCompactFontData(FONTS));
          //   // setFonts(FONTS);
          // }, []);

          return (
            <div style={{ width: '100%', height: '80vh' }}>
              <Editor />
            </div>
          );
        };
        export default VideoEditorComponent;
        ```

3.  **Integrate `VideoEditorComponent` into a `StoryTailor` Page:**
    *   Render `VideoEditorComponent` within a suitable Next.js page (e.g., `/story/[id]/edit-video`).

4.  **Address Styling:**
    *   Import `react-video-editor/src/index.css` if it contains essential base styles for the editor.
    *   Update `StoryTailor/tailwind.config.ts` to include `react-video-editor`'s source files in the `content` array for class scanning.
        ```javascript
        // StoryTailor/tailwind.config.ts
        content: [
          // ... existing paths
          '../react-video-editor/src/**/*.{js,ts,jsx,tsx,mdx}',
        ],
        ```
    *   Acknowledge and plan to reconcile minor shadcn/ui style differences ("default" vs. "new-york", base colors).

### Phase 2: Data Flow - `StoryTailor` to `react-video-editor`

1.  **Define Data Structures:**
    *   Specify the format for story data (scenes, assets, text, timings, audio URLs) to be passed to the editor.
    *   Align this with the data structures expected by `react-video-editor`'s main Zustand store (`use-store.ts`) and Remotion compositions.

2.  **Adapt `Editor` Component or its Stores in `react-video-editor`:**
    *   Modify the `Editor` component to accept initial video project data via props.
    *   Alternatively, expose actions in its Zustand stores (e.g., `initializeTimeline(data)`) that can be called from `StoryTailor`.

3.  **Pass Data from `StoryTailor`:**
    *   In `VideoEditorComponent.tsx`, fetch/prepare story data.
    *   Transform and pass this data to the embedded `Editor` using the mechanism defined in step 2.

### Phase 3: Data Flow - `react-video-editor` to `StoryTailor` (Saving Changes)

1.  **Define "Save" Action in `react-video-editor`:**
    *   Ensure a "Save" mechanism exists within the `Editor`'s UI (e.g., a button in its `Navbar`).

2.  **Expose Data or Callback from `react-video-editor`:**
    *   **Preferred:** The `Editor` component should accept an `onSave` callback prop (e.g., `onSave={(videoData) => { ... }}`).
    *   When "Save" is triggered in the editor, it calls `onSave` with the current video project state.
    *   `StoryTailor`'s `VideoEditorComponent` provides this callback to handle saving the data (e.g., to Firebase).

### Phase 4: Remotion Rendering and Export

1.  **Understand `react-video-editor`'s Export/Rendering:**
    *   Analyze how `react-video-editor` currently handles Remotion rendering (client-side, server-side with `@remotion/lambda`, etc.).

2.  **Integrate Rendering into `StoryTailor`:**
    *   Determine if client-side rendering is sufficient or if server-side rendering (e.g., via Remotion Lambda on Google Cloud) is needed for `StoryTailor`.
    *   The editor's "Export" functionality should trigger this process.
    *   The resulting video URL/data needs to be managed and saved by `StoryTailor`.

### Phase 5: UI/UX Refinements

1.  **Customize Editor UI:**
    *   Adapt `react-video-editor`'s `Navbar`, `ControlList`, etc., to suit `StoryTailor`'s specific workflow.
    *   Decide whether to copy specialized UI components from `react-video-editor` (e.g., `droppable.tsx`, `resizable.tsx`) into `StoryTailor`'s `src/components/ui` or use them directly, managing style consistency.

2.  **Error Handling & Loading States:**
    *   Implement comprehensive loading indicators and error messages throughout the editing and rendering process.

## 4. Technical Considerations & Challenges

*   **Transpiling Local Package:** Correctly configuring Next.js (`transpilePackages`) to bundle the `react-video-editor` source if it's not pre-built.
*   **State Management Bridging:** Designing a clean interface (props down, callbacks up) between `StoryTailor`'s state and `react-video-editor`'s Zustand stores.
*   **Remotion Expertise:** Familiarity with Remotion's API will be necessary for adapting and extending video compositions.
*   **Styling Conflicts:** Vigilance for CSS conflicts, leveraging `tailwind-merge` and careful scoping.
*   **Build Process of `react-video-editor`:** If `react-video-editor` relies on Vite-specific build features, adapting it for consumption by Next.js might require adjustments or a pre-build step for `react-video-editor`.

## 5. User Specific Request & Targeted Plan (Replacing `assemble-video`)

### 5.1. User's Specific Request

"Replace the `StoryTailor`'s `assemble-video` page (and all references to it) with the `react-video-editor` main page style (identical to that) and ensure it points to `StoryTailor`'s Firebase storage for images, audio, and other files, so that the input media corresponds to `StoryTailor`."

### 5.2. Targeted Plan for Replacing `assemble-video`

This plan focuses on embedding `react-video-editor` as the new `assemble-video` experience, ensuring it uses `StoryTailor`'s data and matches the visual style of the standalone `react-video-editor`.

**Phase A: Deprecate Old `assemble-video` and Set Up New Editor Page**

1.  **Isolate Old `assemble-video` Page:**
    *   Locate the existing `StoryTailor/src/app/(app)/assemble-video/page.tsx` and its associated components/directory.
    *   Rename the `StoryTailor/src/app/(app)/assemble-video/` directory to `assemble-video_old/` to preserve its code while deactivating it.

2.  **Create New `assemble-video` Page Structure:**
    *   Create a new directory: `StoryTailor/src/app/(app)/assemble-video/`.
    *   Inside this, create a new `page.tsx`. This file will host the `react-video-editor`.
    *   This new `page.tsx` should be a client component (`"use client";`).

3.  **Initial `VideoEditorComponent` Setup (Conceptual in the new `page.tsx`):**
    *   Import the main `Editor` component from `remotion-captions` (i.e., `react-video-editor`).
    *   Include logic to initialize editor's global data (e.g., fonts), similar to `react-video-editor/src/app.tsx`.
    *   Set up a basic full-screen div to host the `<Editor />`.

4.  **Verify Navigation/Links:**
    *   Ensure existing links in `StoryTailor` (e.g., from dashboard or create-story page) correctly point to the new `/assemble-video` route (which they likely already do).

**Phase B: Styling and Appearance**

1.  **Tailwind CSS Configuration:**
    *   Update `StoryTailor/tailwind.config.ts`: Add the path to `react-video-editor/src/` in the `content` array to allow Tailwind to scan its classes.
    *   Example: `../react-video-editor/src/**/*.{js,ts,jsx,tsx,mdx}`.

2.  **Import `react-video-editor` Base Styles:**
    *   In the new `StoryTailor/src/app/(app)/assemble-video/page.tsx`, import `react-video-editor`'s main CSS file (e.g., `remotion-captions/src/index.css`).

3.  **Full-Screen Host Styling:**
    *   Style the `div` wrapper for the `<Editor />` in the new `page.tsx` to occupy the full viewport and have a dark background, mimicking `react-video-editor`'s standalone appearance.

4.  **Shadcn/UI Theme Considerations:**
    *   Initially, `StoryTailor`'s "default" theme will apply. `react-video-editor` uses "new-york". The imported CSS and Tailwind scanning should provide a close look.
    *   Fine-tune with specific overrides in `StoryTailor` if exact visual parity for certain elements is critical later.

**Phase C: Connecting to `StoryTailor`'s Firebase Data**

1.  **Implement Firebase Data Fetching in New `page.tsx`:**
    *   Develop robust logic to fetch the current `storyId`'s data from Firebase. This includes:
        *   Story script, scene breakdowns, and timings.
        *   Media asset metadata: URLs for images, audio (from Firebase Storage), durations, etc.

2.  **Data Transformation Logic:**
    *   Convert the fetched `StoryTailor` data (assets, script, scenes) into the precise data structure expected by `react-video-editor`'s main Zustand store (`use-store.ts`) and its Remotion compositions.
    *   This involves mapping asset types, calculating durations in frames, and structuring timeline layers/tracks.

3.  **Initialize `react-video-editor`'s Store:**
    *   Use an action on `react-video-editor`'s main Zustand store (e.g., `loadProject(transformedData)`) to populate the editor with `StoryTailor`'s data.
    *   If such an action doesn't exist in `react-video-editor/src/features/editor/store/use-store.ts`, it will need to be added there. This action will set the necessary state for the timeline, assets, Remotion settings, etc.

**Phase D: Saving Project State and Exporting Video**

1.  **Implement "Save Project" Functionality:**
    *   The `Editor` component in `react-video-editor` needs to be able to provide its current state (video project data from its Zustand store).
    *   The new `page.tsx` in `StoryTailor` should pass an `onSave` callback to the `<Editor />` component.
    *   When a "Save" action is triggered within the editor, this `onSave` callback will receive the data and save it to the appropriate story document in Firebase (e.g., in a `videoProject` field).

2.  **Integrate Video Export:**
    *   Leverage `react-video-editor`'s existing Remotion-based export capabilities.
    *   The export process (client-side or server-side via Remotion Lambda) will be initiated from the editor.
    *   `StoryTailor` will need to manage the final rendered video URL and associate it with the story. For server-side rendering, this involves setting up the rendering infrastructure.

**Implementation Order / Key Next Steps:**

1.  **Local Package Link & Transpilation:** Ensure `StoryTailor` can import and use `react-video-editor` components.
2.  **Basic Editor Rendering:** Get the `<Editor />` from `react-video-editor` displaying on the new, empty `assemble-video/page.tsx`.
3.  **Firebase Data Fetching:** Implement the functions in `page.tsx` to retrieve all necessary story and asset data from Firebase.
4.  **Understand `react-video-editor` Data Model:** Thoroughly analyze `react-video-editor`'s `use-store.ts` and related interfaces to know the target data structure for initialization.
5.  **Add Initialization Action to `react-video-editor`:** If needed, add a `loadProject(data)` or similar action to `react-video-editor`'s main store.
6.  **Implement Data Transformation:** Write the logic in `StoryTailor`'s `page.tsx` to convert Firebase data to `react-video-editor`'s format and call the initialization action.
7.  **Test Data Loading:** Verify the editor correctly loads and displays media and timeline structure from `StoryTailor`.
8.  **Implement Save Functionality:** Wire up the `onSave` callback and Firebase update.
9.  **Address Export:** Integrate the video rendering/export flow.
10. **UI/Styling Refinement:** Polish the visual integration and ensure it meets the "identical look" requirement.