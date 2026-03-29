// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title TestERC20
/// @notice Generic ERC20 token for testnet use (e.g. WETH, WBTC).
///         No access control on mint — anyone can mint freely on testnet.
contract TestERC20 is ERC20 {
    uint8 private immutable _decimals;

    /// @param name_     Token name (e.g. "Wrapped Ether")
    /// @param symbol_   Token symbol (e.g. "WETH")
    /// @param decimals_ Number of decimals (e.g. 18 for WETH, 8 for WBTC)
    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    /// @inheritdoc ERC20
    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @notice Mint tokens to any address. No access control — testnet only.
    /// @param to     Recipient address
    /// @param amount Amount to mint (in token's base units)
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
