/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1", "10.0.0.3", "localhost"],
  /**
   * 关闭右下角开发指示器，避免与「页面一直在 Rendering」的误解；
   * 编译/运行时错误仍会通过 Next 浮层展示。
   */
  devIndicators: false
};

export default nextConfig;
