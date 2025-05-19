# @torch-finance/wallet-utils

## 0.2.1

### Patch Changes

- 0cb2208: Should set orderSeqno in multisig wallet send new order

## 0.2.0

### Minor Changes

- 4dfa20a: add support for wallet v4

## 0.1.6

### Patch Changes

- e2413fb: change default config of highload wallet. timeout set to 120. createdAt set to now() - 30 seconds.

## 0.1.5

### Patch Changes

- 8f6aa6c: refactor: improve highload wallet V3 options and default behavior

  - Added optional `createdAt` parameter to control message timestamp
  - Renamed `on_fail` to `onFail` for consistency
  - Updated default `createdAt` timestamp to current time
  - Simplified error handling in retry mechanism

## 0.1.4

### Patch Changes

- fa8c28f: simplify retry utility error logging

## 0.1.3

### Patch Changes

- 6a5bde9: refactor: improve wallet creation methods with enhanced documentation and type simplification

  - Simplified return types for wallet creation functions
  - Added comprehensive JSDoc comments explaining function purposes and parameters
  - Removed unnecessary type imports and simplified type declarations
  - Updated function signatures to improve readability and maintainability

## 0.1.2

### Patch Changes

- 528da8c: modify retry function for passing error as an argument of on_fail function

## 0.1.1

### Patch Changes

- 204f863: Fix wallet v5 testnet wallet id to -3

## 0.1.0

### Minor Changes

- 919deaa: feat: add deploy method to highload wallet V3 creation utility

## 0.0.1

### Patch Changes

- 0043929: First release includes highload-wallet, multisig-v2, wallet-v5
