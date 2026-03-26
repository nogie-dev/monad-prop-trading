Execute the full demo scenario and report pass/fail for each step.

Use cast commands against deployed contracts (read addresses from frontend/src/config/addresses.ts).

## Demo Steps:
1. **Fee Deposit**: Approve + deposit USDC fee to PropChallenge
   - `cast send $USDC "approve(address,uint256)" $PROP_CHALLENGE $FEE_AMOUNT --rpc-url $MONAD_RPC --private-key $TRADER_KEY`
   - `cast send $PROP_CHALLENGE "depositFee(uint256)" $FEE_AMOUNT --rpc-url $MONAD_RPC --private-key $TRADER_KEY`
   - Verify: `cast call $PROP_CHALLENGE "getStatus(address)" $TRADER --rpc-url $MONAD_RPC` → should return ACTIVE

2. **Pass Challenge**: Owner calls passChallenge
   - `cast send $PROP_CHALLENGE "passChallenge(address)" $TRADER --rpc-url $MONAD_RPC --private-key $OWNER_KEY`
   - Verify PA deployed: `cast call $FACTORY "getAccount(address)" $TRADER --rpc-url $MONAD_RPC`

3. **Fund PA**: Treasury funds the PA
   - `cast send $TREASURY "fundAccount(address,uint256)" $PA $CAPITAL --rpc-url $MONAD_RPC --private-key $OWNER_KEY`

4. **Successful Trade**: Execute whitelisted swap on PA
   - Build swap calldata and call execute()
   - Should succeed

5. **Blocked Attack #1**: Attempt USDC transfer via PA
   - Build transfer calldata and call execute()
   - Should REVERT ← highlight this

6. **Blocked Attack #2**: Attempt WETH transfer via PA
   - Should REVERT ← highlight this

7. **Settlement**: Trigger profit settlement
   - `cast send $PA "settle()" --rpc-url $MONAD_RPC --private-key $OWNER_KEY`
   - Verify 80/20 split in USDC balances

Report PASS/FAIL for each step.
