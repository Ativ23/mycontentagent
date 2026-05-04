import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['sharp', 'ffmpeg-static', 'music-metadata'],
};

export default nextConfig;
