Deploy all contracts to Monad testnet.

1. Verify .env has MONAD_RPC and PRIVATE_KEY set
2. Run: `cd contracts && forge script script/Deploy.s.sol:DeployScript --rpc-url $MONAD_RPC --broadcast 2>&1`
3. Extract deployed contract addresses from broadcast output
4. Update frontend/src/config/addresses.ts with new addresses:
   ```typescript
   export const ADDRESSES = {
     propChallenge: "0x...",
     accountFactory: "0x...",
     treasury: "0x...",
     usdc: "0x...",
   } as const;
   ```
5. Update PLAN.md with deployment status and addresses
