# **App Name**: StoryTailor

## Core Features:

- AI Script Generation: Generate an animated video script using a prompt. The tool incorporates themes, character descriptions, and story twists based on user inputs, tailored for children and adults, maintaining a specific word count for optimal engagement. Example of prompt from the user: "Create a fun and engaging animated storyline. It features a (brave little fox exploring the forest). Include themes (of environmental awareness and courage). Add a series of whimsical and exciting adventures. Layer depth and subtle twists into the narrative. Captivate both children and adults with the story. Keep the length around 300 words for engagement. Start with something like (“Rusty”)"
- Narration Audio Generation: Create narration audio using the generated script. Integrates with ElevenLabs API to produce high-quality MP3 audio for video narration, automatically synced with the script.
- Prompt Autogeneration: Create detailed character/item/location prompts based on the main script. Examples of prompts: Characters Rusty a sleek 3yo red fox with bright copper fur and amber eyes, wearing a woven fern satchel. Owl an aged 15yo white and brown owl with mottled plumage and a tattered olive-green cloak. Squirrel a small 2yo grey tree squirrel with short, fluffy fur and a vibrant blue scarf. Locations Forest an expansive woodland of ancient oaks and towering evergreens, dappled with soft sunlight. Stream a bubbling, clear water stream with mossy banks and sunlight glints on its surface. Twisting Cave a narrow, winding cavern with irregular rock formations and glistening, shadowed walls. Items Satchel a compact bag crafted from woven ferns with a natural green texture. Glowstone a tiny radiant pebble that shimmers like a miniature sun with warm, glowing facets.
- AI Image Prompting: Generate a sequence of image prompts tailored to the narration, determining the quantity of images according to the duration of the audio. Creates coherent, scene-specific prompts for the animation. Example of prompts for text to image model: Wide front shot at eye-level of @Rusty standing proudly in a sunlit clearing of the @Forest, his copper coat gleaming in the light. He is standing and looking around. It is a sunny morning. @Satchel Wide panoramic high-angle shot of the @Forest showing ancient oaks and towering evergreens, their canopies filtering sunlight. @Rusty is standing in a sunlit clearing of the @Forest. It is a sunny morning. Medium side shot at eye-level of @Rusty trotting through the @Forest, @Satchel in tow, as he follows a shimmering path. @Rusty is walking, following the path. @Rusty is standing in a sunlit clearing of the @Forest. It is a sunny morning. etc. same for all images (the nr of images will be determined based on the length of mp3 for our story)
- Video Assembly & Export: Arrange video images into a single animation and download the resulting video in MP4 format
- User Authentication: User authentication must me added to store the user data - stories (each story stores all the details in the database - story, prompts for all characters/locations/items, prompts for images, images, prompts for image to video, each video etc.)
- Database Structure: Database structure- tables for each items - use your architect mode to think a good structure.

## Style Guidelines:

- Primary color: Soft teal (#A0E7E5) for a calming, story-like atmosphere.
- Secondary color: Light beige (#E6D8B9) for backgrounds, to ensure comfortable readability.
- Accent: Coral (#FF6F61) for interactive elements and call-to-action buttons, ensuring an approachable interface.
- Clean and readable fonts for easy story consumption.
- Friendly and whimsical icons to guide users.
- Clean and spacious layout with clear sections for prompt input, script preview, and video display.
- Gentle transitions and loading animations for a seamless user experience.