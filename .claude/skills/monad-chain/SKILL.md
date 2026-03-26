---
name: monad-chain
description: Monad blockchain specifics - RPC endpoints, chain ID, gas behavior, EVM compatibility, deployment config. Use when deploying, configuring chain, or writing deployment scripts.
---

# Monad Chain Reference

## Chain Info
- Type: EVM-compatible L1, high throughput
- Consensus: MonadBFT
- Execution: Parallel EVM (pipelining)
- Gas: significantly lower than Ethereum mainnet
- Solidity: fully compatible (standard EVM opcodes)

## Testnet Configuration
- RPC: (set in .env as MONAD_RPC)
- Chain ID: (set in .env as MONAD_CHAIN_ID)
- Block Explorer: (set in .env as MONAD_EXPLORER)
- Native token: MON (used for gas only in this project)

## Foundry Deployment
```bash
# Deploy
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $MONAD_RPC \
  --broadcast \
  --verify

# Verify separately
forge verify-contract <address> src/TradingAccount.sol:TradingAccount \
  --rpc-url $MONAD_RPC
```

## ethers.js v6 Connection
```typescript
import { ethers } from "ethers";
const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_MONAD_RPC);
```

## Notes
- Standard EVM tooling works (Foundry, Hardhat, ethers.js)
- No special opcodes or precompiles needed for this project
- High TPS means paper trading position recording is cheap
