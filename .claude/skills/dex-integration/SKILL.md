---
name: dex-integration
description: DEX router interfaces, swap function selectors, whitelisting patterns for TradingAccount. Use when implementing execute() validation, setting up whitelist, or integrating with DEX.
---

# DEX Integration Reference

## Whitelisted Function Selectors (SAFE for PA)

### Uniswap V2 Router Style
| Function | Selector | Notes |
|----------|----------|-------|
| swapExactTokensForTokens | 0x38ed1738 | Fixed input amount |
| swapTokensForExactTokens | 0x8803dbee | Fixed output amount |

### Uniswap V3 Router Style
| Function | Selector | Notes |
|----------|----------|-------|
| exactInputSingle | 0x414bf389 | Single pool swap |
| exactInput | 0xc04b8d59 | Multi-hop swap |
| exactOutputSingle | 0x5023b4df | Single pool, fixed output |
| exactOutput | 0xf28c0498 | Multi-hop, fixed output |

## BLOCKED Selectors (NEVER whitelist)
| Function | Selector | Why |
|----------|----------|-----|
| transfer | 0xa9059cbb | Direct token extraction |
| approve | 0x095ea7b3 | Enables transferFrom by attacker |
| transferFrom | 0x23b872dd | Third-party token extraction |
| increaseAllowance | 0x39509351 | Same risk as approve |
| decreaseAllowance | 0xa457c2d7 | Should not be needed |

## Decoding Swap Parameters

### V2: swapExactTokensForTokens
```solidity
// swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)
(uint256 amountIn, uint256 amountOutMin, address[] memory path, address to, uint256 deadline) =
    abi.decode(data[4:], (uint256, uint256, address[], address, uint256));

// Validate:
// - path[0] and path[path.length-1] must be in allowedTokens
// - `to` must be address(this) (PA itself, not trader's wallet)
```

### V3: exactInputSingle
```solidity
// ExactInputSingleParams { tokenIn, tokenOut, fee, recipient, deadline, amountIn, amountOutMinimum, sqrtPriceLimitX96 }
// Validate:
// - tokenIn and tokenOut must be in allowedTokens
// - recipient must be address(this)
```

## Token Whitelist (Hackathon MVP)
- USDC (base currency)
- WETH (wrapped ETH)
- WBTC (wrapped BTC)
- MON (native wrapper, if applicable)

## Important: `to`/`recipient` Validation
When decoding swap calldata, always verify the output recipient is the PA contract itself (`address(this)`), not the trader's personal wallet. This prevents a swap-and-redirect attack.
