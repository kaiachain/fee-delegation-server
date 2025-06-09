import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // matching all API routes
        source: "/api/signAsFeePayer",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "false" },
          { key: "Access-Control-Allow-Origin", value: "*" }, // replace this your actual origin
          {
            key: "Access-Control-Allow-Methods",
            value: "POST",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "Content-Length, Content-Type, Authorization",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
