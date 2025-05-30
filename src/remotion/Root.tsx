"use client";

import React from 'react';
import { StoryVideo } from './StoryVideo';

export const RemotionRoot: React.FC = () => {
  console.log('Setting up Remotion Root - delegating to StoryVideo');
  
  return (
    <>
      <StoryVideo />
    </>
  );
};