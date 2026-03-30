#!/usr/bin/env bash
set -euo pipefail

# Requires: MONAD_RPC, PRIVATE_KEY
# Optionally overrides via env:
#   USDC_ADDRESS, WETH_ADDRESS, WBTC_ADDRESS, POOL_USDC_WETH, POOL_USDC_WBTC, CHAIN_ID

: "${MONAD_RPC:?}"
: "${PRIVATE_KEY:?}"
: "${USDC_ADDRESS:=0x4CcE72aD2238aaAeD9c5A93767255bA4D02CB525}"
: "${WETH_ADDRESS:=0xbeC6b351fD2513A2aCa7747370438E744b3E9704}"
: "${WBTC_ADDRESS:=0xD435C08700CEB4a75eb55A0156206646baEB5Cc7}"
: "${POOL_USDC_WETH:=0x515b07230353694680301efFce4cBA1916C158d9}"
: "${POOL_USDC_WBTC:=0x882F770E6D5C8628BbF3cC886c7e47Efc37498Ff}"
: "${CHAIN_ID:=10143}"

echo "Using RPC: $MONAD_RPC"

# ----- USDC/WETH (500,000 USDC / 250 WETH) -----
cast send "$USDC_ADDRESS" \
  "approve(address,uint256)" "$POOL_USDC_WETH" 500000000000 \
  --rpc-url "$MONAD_RPC" --private-key "$PRIVATE_KEY" --chain-id "$CHAIN_ID"

cast send "$WETH_ADDRESS" \
  "approve(address,uint256)" "$POOL_USDC_WETH" 250000000000000000000 \
  --rpc-url "$MONAD_RPC" --private-key "$PRIVATE_KEY" --chain-id "$CHAIN_ID"

cast send "$POOL_USDC_WETH" \
  "addLiquidity(uint256,uint256)" 500000000000 250000000000000000000 \
  --rpc-url "$MONAD_RPC" --private-key "$PRIVATE_KEY" --chain-id "$CHAIN_ID"

# ----- USDC/WBTC (500,000 USDC / 7.5 WBTC @ 8 decimals) -----
cast send "$USDC_ADDRESS" \
  "approve(address,uint256)" "$POOL_USDC_WBTC" 500000000000 \
  --rpc-url "$MONAD_RPC" --private-key "$PRIVATE_KEY" --chain-id "$CHAIN_ID"

cast send "$WBTC_ADDRESS" \
  "approve(address,uint256)" "$POOL_USDC_WBTC" 750000000 \
  --rpc-url "$MONAD_RPC" --private-key "$PRIVATE_KEY" --chain-id "$CHAIN_ID"

cast send "$POOL_USDC_WBTC" \
  "addLiquidity(uint256,uint256)" 500000000000 750000000 \
  --rpc-url "$MONAD_RPC" --private-key "$PRIVATE_KEY" --chain-id "$CHAIN_ID"

echo "Liquidity added."
