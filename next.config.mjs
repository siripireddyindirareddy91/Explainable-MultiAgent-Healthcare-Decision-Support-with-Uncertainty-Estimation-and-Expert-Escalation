const config = {
  async rewrites() {
    return process.env.NODE_ENV === "development" || process.env.BACKEND_URL
      ? [
          {
            source: "/api/:path*",
            destination: `${process.env.BACKEND_URL || "http://127.0.0.1:8000"}/api/:path*`,
          },
        ]
      : [];
  },
};
export default config;
