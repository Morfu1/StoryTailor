const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'aicdn.picsart.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Add transpilePackages to handle Remotion properly
  transpilePackages: ['@remotion/cli', '@remotion/bundler', '@remotion/renderer', '@remotion/player'],
  
  // Configure webpack to handle TypeScript declaration files properly
  webpack: (config, { isServer }) => {
    // Ignore TypeScript declaration files from esbuild that cause parsing errors
    config.module.rules.push({
      test: /\.d\.ts$/,
      loader: 'ignore-loader',
    });

    // Resolve Remotion platform-specific modules to our mock implementation
    // This prevents errors when modules for other platforms are imported
    config.resolve.alias = {
      ...config.resolve.alias,
      // Use our mocks for the platform-specific modules that are causing errors
      '@remotion/compositor-win32-x64-msvc': path.resolve(__dirname, 'src/mocks/compositor-win32-x64-msvc.js'),
      '@remotion/compositor-linux-x64-musl': path.resolve(__dirname, 'src/mocks/compositor-linux-x64-musl.js'),
      '@remotion/compositor-linux-x64-gnu': path.resolve(__dirname, 'src/mocks/compositor-linux-x64-gnu.js'),
      '@remotion/compositor-darwin-x64': path.resolve(__dirname, 'src/mocks/compositor-darwin-x64.js'),
      '@remotion/compositor-darwin-arm64': path.resolve(__dirname, 'src/mocks/compositor-darwin-arm64.js'),
    };

    // For other platform-specific modules, use empty modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      // Handle other Windows compositor modules when on non-Windows
      '@remotion/compositor-win32-ia32-msvc': false,
      '@remotion/compositor-win32-arm64-msvc': false,
      // Handle other Linux compositor modules when on non-Linux
      '@remotion/compositor-linux-arm64-gnu': false,
      '@remotion/compositor-linux-arm64-musl': false,
    };

    return config;
  },
};

module.exports = nextConfig;