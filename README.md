# StoryTailor - AI Animated Story Generator

This is a Next.js application, StoryTailor, that allows users to generate animated video scripts, narration audio, image prompts, and eventually videos, using AI. It features user authentication and stores story data in Firebase Firestore.

## Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- npm or yarn
- A Firebase project

### 1. Clone the Repository

```bash
git clone <repository-url>
cd story-tailor
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Set Up Firebase

1.  **Create a Firebase Project**: Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2.  **Register Your App**:
    *   In your Firebase project, go to Project Settings.
    *   Under "Your apps", click the Web icon (`</>`) to add a new web app.
    *   Give your app a nickname and click "Register app".
    *   Firebase will provide you with a `firebaseConfig` object. You'll need these values for your environment variables.
3.  **Enable Authentication**:
    *   In the Firebase console, go to "Authentication" (under Build).
    *   Click "Get started".
    *   On the "Sign-in method" tab, enable "Email/Password" provider.
4.  **Set Up Firestore**:
    *   In the Firebase console, go to "Firestore Database" (under Build).
    *   Click "Create database".
    *   Start in **production mode**.
    *   Choose a Firestore location (this cannot be changed later).
    *   Click "Enable".

### 4. Configure Environment Variables

Create a `.env.local` file in the root of your project and add your Firebase configuration keys. You can find these in your Firebase project settings after registering your web app.

**File: `.env.local`**
```env
NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"

# Optional: For Genkit with Google AI Studio (Gemini)
# GOOGLE_API_KEY="YOUR_GOOGLE_AI_STUDIO_API_KEY"
```

Replace `"YOUR_..."` with your actual Firebase project credentials.

### 5. Configure Firestore Security Rules

The application requires specific Firestore security rules to function correctly, allowing users to manage their own stories.

1.  Copy the contents of the `firestore.rules` file (located in the root of this project).
2.  In the Firebase console, go to "Firestore Database" > "Rules" tab.
3.  Paste the copied rules into the editor, replacing any existing rules.
4.  Click "Publish".

The `firestore.rules` file should contain rules similar to this:
```rules
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Stories:
    // - Authenticated users can create stories for themselves.
    // - Authenticated users can read, update, delete their own stories.
    // - No one can read/write stories of other users.
    match /stories/{storyId} {
      allow read, update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

### 6. Run the Development Server

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:9002](http://localhost:9002) (or the port specified in `package.json`) with your browser to see the result.

### Genkit Development (Optional)

If you are working with Genkit flows:
```bash
npm run genkit:watch
```
This will start the Genkit development server, typically on port 3400.

## Core Features

-   **AI Script Generation**: Generate video scripts from prompts.
-   **Narration Audio Generation**: Create MP3 narration from scripts (placeholder, ElevenLabs integration planned).
-   **Prompt Autogeneration**: Create detailed character/item/location prompts.
-   **AI Image Prompting**: Generate image prompts based on narration duration.
-   **Video Assembly & Export**: (Future Feature) Arrange images into MP4.
-   **User Authentication**: Secure user accounts.
-   **Database Structure**: Stores story data in Firestore.

## Style Guidelines

-   **Primary color**: Soft teal (`#A0E7E5`)
-   **Secondary color**: Light beige (`#E6D8B9`)
-   **Accent**: Coral (`#FF6F61`)
-   Clean, readable fonts and friendly icons.
-   Spacious layout with gentle transitions.

## Tech Stack

-   Next.js (App Router)
-   React
-   TypeScript
-   Tailwind CSS
-   ShadCN/UI
-   Firebase (Authentication, Firestore)
-   Genkit (for AI flows)

## Troubleshooting

-   **Firebase Errors (e.g., "Missing or insufficient permissions")**:
    *   Ensure your `.env.local` file is correctly configured with your Firebase project credentials.
    *   Verify that you have published the correct Firestore security rules as described in Step 5.
    *   Make sure the Email/Password authentication provider is enabled in Firebase.
-   **Genkit Errors**:
    *   If using Google AI, ensure `GOOGLE_API_KEY` is set in `.env.local` and the Generative Language API (or appropriate AI model API) is enabled in your Google Cloud project.
    *   Check the Genkit development server logs (`npm run genkit:watch`) for more detailed error messages.
```