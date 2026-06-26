/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a fully static site (out/) so Cloudflare can serve it as static assets.
  output: "export",
  // No Next.js Image Optimization server in a static export.
  images: { unoptimized: true },
};

export default nextConfig;
