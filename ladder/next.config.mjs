/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a fully static site (out/) so it can be served by Cloudflare Pages.
  output: "export",
  // No Next.js Image Optimization server in a static export.
  images: { unoptimized: true },
};

export default nextConfig;
