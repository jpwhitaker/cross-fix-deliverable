import type { NextConfig } from "next";
const isDev = process.env.NODE_ENV !== "production";
const nextConfig: NextConfig = {
    devIndicators: false,
    allowedDevOrigins: ["127.0.0.1", "192.168.4.22", "JP-Mac-Studio.local", "*.local", "192.168.*.*"],
    onDemandEntries: {
        maxInactiveAge: 30 * 60 * 1000,
        pagesBufferLength: 10,
    },
    turbopack: {
        rules: {
            "*.svg": {
                loaders: ["@svgr/webpack"],
                as: "*.js",
            },
        },
    },
    webpack(config) {
        config.module.rules.push({
            test: /\.svg$/i,
            use: ["@svgr/webpack"],
        });
        return config;
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "lh3.googleusercontent.com",
                pathname: "/**",
            },
        ],
    },
    async redirects() {
        return [];
    },
    async headers() {
        if (isDev)
            return [];
        return [
            {
                source: "/dictionary.json",
                headers: [
                    {
                        key: "Cache-Control",
                        value: "public, max-age=604800, stale-while-revalidate=86400",
                    },
                ],
            },
            {
                source: "/:path*",
                headers: [
                    {
                        key: "Content-Security-Policy",
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-inline'",
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                            "font-src 'self' https://fonts.gstatic.com",
                            "img-src 'self' blob: data: https://lh3.googleusercontent.com",
                            "connect-src 'self'",
                            "object-src 'none'",
                            "frame-ancestors 'none'",
                        ].join("; "),
                    },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                ],
            },
        ];
    },
};
export default nextConfig;
