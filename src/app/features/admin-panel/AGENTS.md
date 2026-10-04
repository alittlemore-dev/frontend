# Admin Panel Instructions

These rules apply to every file under `src/app/features/admin-panel/`.

## Access and Rendering

- Keep admin-panel routes protected and CSR-only. Enforce the matching backend role boundary; do
  not expose private admin responses through SSR or the hydration transfer cache.
- Keep narrower owner-only and owner/admin workspaces behind their dedicated child guards instead
  of treating every admin-panel role as equivalent.
