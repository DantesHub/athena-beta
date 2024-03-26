import nodeExternals from 'webpack-node-externals';

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Only run the package exclusion on the server
    if (isServer) {
      config.externals = ['onnxruntime-node', 'sharp', 'fsevents', ...config.externals];  
    }

    return config;
  },
};

export default nextConfig;