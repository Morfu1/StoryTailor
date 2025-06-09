"use client";

import React from 'react';
import { Composition } from 'remotion'; // Import Composition
import { StoryVideo } from './StoryVideo';

export const RemotionRoot: React.FC = () => {
  // This console.log might not appear if stderr capture is problematic at this level
  console.log('[RemotionRoot.tsx] Setting up RemotionRoot component.'); 
  
  return (
    <>
      {/* Existing StoryVideo Composition - will be called if ID is "StoryVideo" */}
      <StoryVideo />

         
    </>
  );
};
