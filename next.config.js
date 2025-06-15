
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
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'minio-api.holoanima.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
  transpilePackages: [
    '@remotion/cli', 
    '@remotion/bundler', 
    '@remotion/renderer', 
    '@remotion/player',
    '@remotion/media-parser', // Added
    '@remotion/licensing'    // Added
  ],
  
  webpack: (config, { isServer }) => {
    // Ignore TypeScript declaration files from esbuild that cause parsing errors
    config.module.rules.push({
      test: /\.d\.ts$/,
      loader: 'ignore-loader',
    });

    config.resolve.alias = {
      ...config.resolve.alias,
      'handlebars': 'handlebars/dist/handlebars.js',
      '@remotion/compositor-win32-x64-msvc': path.resolve(__dirname, 'src/mocks/compositor-win32-x64-msvc.js'),
      '@remotion/compositor-linux-x64-musl': path.resolve(__dirname, 'src/mocks/compositor-linux-x64-musl.js'),
      '@remotion/compositor-linux-x64-gnu': path.resolve(__dirname, 'src/mocks/compositor-linux-x64-gnu.js'),
      '@remotion/compositor-darwin-x64': path.resolve(__dirname, 'src/mocks/compositor-darwin-x64.js'),
      '@remotion/compositor-darwin-arm64': path.resolve(__dirname, 'src/mocks/compositor-darwin-arm64.js'),
    };

    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@remotion/compositor-win32-ia32-msvc': false,
      '@remotion/compositor-win32-arm64-msvc': false,
      '@remotion/compositor-linux-arm64-gnu': false,
      '@remotion/compositor-linux-arm64-musl': false,
    };

    // Ensure config.module.noParse is initialized if it doesn't exist
    config.module.noParse = config.module.noParse || [];
    
    // Add noParse rule for problematic Remotion files
    // These regexes target the specific files mentioned in your build error.
    config.module.noParse.push(
      /node_modules\/@remotion\/licensing\/dist\/register-usage-point\.js$/,
      /node_modules\/@remotion\/media-parser\/dist\/aac-codecprivate\.js$/,
      /node_modules\/@remotion\/media-parser\/dist\/containers\/flac\/parse-flac-frame\.js$/,
      /node_modules\/@remotion\/media-parser\/dist\/containers\/iso-base-media\/esds\/esds-descriptors\.js$/,
      /node_modules\/@remotion\/media-parser\/dist\/containers\/iso-base-media\/find-track-to-seek\.js$/,
      /node_modules\/@remotion\/media-parser\/dist\/containers\/iso-base-media\/mdat\/mdat\.js$/,
      /node_modules\/@remotion\/media-parser\/dist\/containers\/iso-base-media\/stsd\/samples\.js$/,
      /node_modules\/@remotion\/media-parser\/dist\/containers\/iso-base-media\/traversal\.js$/,
      /node_modules\/@remotion\/media-parser\/dist\/containers\/m3u\/get-playlist\.js$/,
      /node_modules\/@remotion\/media-parser\/dist\/containers\/m3u\/get-seeking-byte\.js$/
    );

    return config;
  },
};

module.exports = nextConfig;
