import { join } from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Standalone output for cPanel deployment (enabled in production/CI)
  // Disabled locally on Windows due to symlink permission requirements
  // output: 'standalone',
  // outputFileTracingRoot: join(__dirname, '../../'),
};

export default nextConfig;
