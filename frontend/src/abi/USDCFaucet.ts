export const USDCFaucetABI = [
  {
    "type": "function",
    "name": "drip",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "cooldownRemaining",
    "inputs": [{ "name": "user", "type": "address", "internalType": "address" }],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "lastClaim",
    "inputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "DRIP_AMOUNT",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "COOLDOWN",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "error",
    "name": "CooldownNotElapsed",
    "inputs": [{ "name": "remainingSeconds", "type": "uint256", "internalType": "uint256" }]
  },
  {
    "type": "error",
    "name": "InsufficientFaucetBalance",
    "inputs": []
  },
  {
    "type": "event",
    "name": "Dripped",
    "inputs": [
      { "name": "to", "type": "address", "indexed": true },
      { "name": "amount", "type": "uint256", "indexed": false }
    ]
  }
] as const;
