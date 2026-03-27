import type { NextConfig } from "next";

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'taohtzdmqsvhbxfqfvmq.supabase.co',
      },
    ],
  },
}

export default nextConfig


