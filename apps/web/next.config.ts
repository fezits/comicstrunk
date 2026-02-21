import { join } from 'path';
import type { NextConfig } from 'next';

// Standalone output for cPanel Passenger deployment
// Enabled only in CI or explicitly via STANDALONE=true environment variable.
// Windows dev environments lack symlink permissions (EPERM) — the standalone
// trace phase creates symlinks that require elevated privileges on Windows.
// On the Linux cPanel server (or CI), this works without issues.
const enableStandalone = !!process.env.CI || process.env.STANDALONE === 'true';

const nextConfig: NextConfig = {
  ...(enableStandalone
    ? {
        output: 'standalone' as const,
        outputFileTracingRoot: join(__dirname, '../../'),
      }
    : {}),
};

export default nextConfig;
