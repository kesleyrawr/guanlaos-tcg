# GUANLAO'S TCG Collector

GitHub is the source of truth for the GUANLAO'S TCG Collector migration.

## Hosting

Designed for Cloudflare Pages connected to this repository.

- Frontend: static app in the repository root
- API bridge: Cloudflare Pages Functions under `functions/api/`
- Local collection: browser storage
- PC backup: one fixed file, `GUANLAOS-TCG-BACKUP.json`, overwritten after collection changes

## Migration status

The frontend has been recovered from the published app and the PC auto-backup logic has been patched so automatic backups use one fixed file instead of accumulating timestamped files.

During the first migration stage, `/api/card-search`, `/api/card-image`, and `/api/prices` proxy the existing service so card search, images, and live pricing can keep working. Those routes can later be replaced with independent implementations without changing the frontend URL.
