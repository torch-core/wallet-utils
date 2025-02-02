---
'@torch-finance/wallet-utils': patch
---

refactor: improve highload wallet V3 options and default behavior

- Added optional `createdAt` parameter to control message timestamp
- Renamed `on_fail` to `onFail` for consistency
- Updated default `createdAt` timestamp to current time
- Simplified error handling in retry mechanism
