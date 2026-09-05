import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transformers.js selects onnxruntime-node in a Node.js route. The native
  // binding loads libonnxruntime.so.1 from this same directory at runtime, so
  // both files must be traced into the deployed image-search function.
  outputFileTracingIncludes: {
    "/api/ai/image-search": [
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**",
    ],
  },
  serverExternalPackages: ["onnxruntime-node"],
  images: {
    remotePatterns: [
      {
        hostname: "**",
        protocol: "https",
      },
    ],
  },
};

export default nextConfig;
