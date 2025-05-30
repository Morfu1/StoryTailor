// This file is the entry point for Remotion rendering
const { registerRoot } = require('remotion');
const { RemotionRoot } = require('./Root.jsx');

// Register the root component
registerRoot(RemotionRoot);