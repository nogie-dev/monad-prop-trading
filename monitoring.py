import asyncio
import json
import os
from decimal import Decimal
from pathlib import Path
from typing import List, Tuple

from aiohttp import web
from dotenv import load_dotenv
from web3 import Web3
from web3.middleware import geth_poa_middleware

# Load .env next to this file
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

# Env config
PRICE_RPC = os.getenv("MONITOR_PRICE_RPC") or os.getenv("MONITOR_RPC")  # oracle price source
STATE_RPC = os.getenv("MONAD_RPC") or os.getenv("MONITOR_STATE_RPC")    # chain state (Monad)
# MONITOR_PRIVATE_KEY is optional; falls back to PRIVATE_KEY
ADMIN_KEY_RAW = (os.getenv("MONITOR_PRIVATE_KEY") or os.getenv("PRIVATE_KEY") or "").strip()
PROP_CHALLENGE = os.getenv("PROP_CHALLENGE_ADDRESS")
MONITOR_INTERVAL = int(os.getenv("MONITOR_INTERVAL", "300"))  # seconds
PRICE_API_PORT = int(os.getenv("PRICE_API_PORT", "8000"))
WETH_ADDRESS = os.getenv("WETH_ADDRESS")
WBTC_ADDRESS = os.getenv("WBTC_ADDRESS")
FEED_ETH = os.getenv("MONITOR_FEED_ETH")  # e.g., Chainlink ETH/USD
FEED_BTC = os.getenv("MONITOR_FEED_BTC")  # e.g., Chainlink BTC/USD
ACCOUNT_FACTORY = os.getenv("ACCOUNT_FACTORY_ADDRESS")
DEX_ROUTER = os.getenv("DEX_ROUTER")
USDC_ADDRESS = os.getenv("USDC_ADDRESS")

# Traders to monitor: env list or default constant
DEFAULT_TRADERS = ["0xBe8C1BBf07940BDf5bB412B78f8C12Af75C7CB96"]
env_traders = [a for a in (os.getenv("MONITOR_TRADERS") or "").split(",") if a]
MONITORED_TRADERS = env_traders if env_traders else DEFAULT_TRADERS

if not ADMIN_KEY_RAW.startswith("0x"):
    raise SystemExit("ADMIN_KEY must be a 0x-prefixed hex private key (MONITOR_PRIVATE_KEY or PRIVATE_KEY)")
if not (STATE_RPC and ADMIN_KEY_RAW and PROP_CHALLENGE):
    raise SystemExit("Missing env: MONAD_RPC (or MONITOR_STATE_RPC), PRIVATE_KEY, PROP_CHALLENGE_ADDRESS")

# Minimal ABI: getEvalAccount(address), failChallenge(address)
PROP_ABI = [
    {
        "type": "function",
        "name": "getEvalAccount",
        "stateMutability": "view",
        "inputs": [{"name": "trader", "type": "address"}],
        "outputs": [
            {
                "type": "tuple",
                "components": [
                    {"name": "virtualBalance", "type": "uint256"},
                    {"name": "initialBalance", "type": "uint256"},
                    {"name": "realizedPnL", "type": "uint256"},
                    {"name": "paActivated", "type": "bool"},
                    {"name": "openPositionCount", "type": "uint8"},
                ],
            }
        ],
    },
    {
        "type": "function",
        "name": "failChallenge",
        "stateMutability": "nonpayable",
        "inputs": [{"name": "trader", "type": "address"}],
        "outputs": [],
    },
    {
        "type": "function",
        "name": "getPositions",
        "stateMutability": "view",
        "inputs": [{"name": "trader", "type": "address"}],
        "outputs": [
            {
                "type": "tuple[]",
                "components": [
                    {"name": "token", "type": "address"},
                    {"name": "isLong", "type": "bool"},
                    {"name": "size", "type": "uint256"},
                    {"name": "entryPrice", "type": "uint256"},
                    {"name": "timestamp", "type": "uint256"},
                    {"name": "isOpen", "type": "bool"},
                ],
            }
        ],
    },
]

# AccountFactory ABI: getAllAccounts
FACTORY_ABI = [
    {
        "type": "function",
        "name": "getAllAccounts",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "address[]"}],
    },
]

# TradingAccount ABI: initialCapital, liquidate
TRADING_ACCOUNT_ABI = [
    {
        "type": "function",
        "name": "initialCapital",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "type": "function",
        "name": "liquidate",
        "stateMutability": "nonpayable",
        "inputs": [{"name": "dexTarget", "type": "address"}],
        "outputs": [],
    },
]

# Minimal ERC20 ABI: balanceOf
ERC20_ABI = [
    {
        "type": "function",
        "name": "balanceOf",
        "stateMutability": "view",
        "inputs": [{"name": "account", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]


# Shared price cache updated by monitor loop
_latest_prices: dict = {}


def usd6(value: int) -> str:
    return f"{Decimal(value) / Decimal(10**6):,.2f}"

SELECTOR_LATEST_ROUND_DATA = "0xfeaf968c"  # latestRoundData()

def fetch_chainlink_prices(w3_price: Web3):
    """Fetch prices from Chainlink feeds via latestRoundData() (8 decimals)."""
    feeds = []
    if FEED_ETH and WETH_ADDRESS:
        feeds.append((Web3.to_checksum_address(WETH_ADDRESS), FEED_ETH))
    if FEED_BTC and WBTC_ADDRESS:
        feeds.append((Web3.to_checksum_address(WBTC_ADDRESS), FEED_BTC))
    prices = {}
    for token_addr, feed_addr in feeds:
        try:
            feed_addr = Web3.to_checksum_address(feed_addr.lower())
            data = w3_price.eth.call({"to": feed_addr, "data": SELECTOR_LATEST_ROUND_DATA})
            # latestRoundData: (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
            # answer is the 2nd field — ABI-encoded at bytes[32:64]
            answer = int.from_bytes(data[32:64], byteorder="big", signed=True)
            prices[token_addr] = float(Decimal(answer) / Decimal(10**8))
        except Exception as e:
            print(f"[monitor] price fetch error for {feed_addr}: {e}")
    return prices


async def monitor_pas(w3: Web3, prices: dict, acct):
    """Monitor live PA accounts and liquidate on drawdown > 10%."""
    if not ACCOUNT_FACTORY or not DEX_ROUTER:
        print("[monitor_pa] ACCOUNT_FACTORY_ADDRESS or DEX_ROUTER not set, skipping PA monitoring")
        return
    if not WETH_ADDRESS or not WBTC_ADDRESS or not USDC_ADDRESS:
        print("[monitor_pa] token addresses not set, skipping PA monitoring")
        return

    factory = w3.eth.contract(
        address=Web3.to_checksum_address(ACCOUNT_FACTORY), abi=FACTORY_ABI
    )

    try:
        pa_addresses = factory.functions.getAllAccounts().call()
    except Exception as e:
        print(f"[monitor_pa] getAllAccounts failed: {e}")
        return

    if not pa_addresses:
        print("[monitor_pa] No PA accounts found")
        return

    weth_addr = Web3.to_checksum_address(WETH_ADDRESS)
    wbtc_addr = Web3.to_checksum_address(WBTC_ADDRESS)
    usdc_addr = Web3.to_checksum_address(USDC_ADDRESS)
    dex_router = Web3.to_checksum_address(DEX_ROUTER)

    weth_price = prices.get(weth_addr, 0)
    wbtc_price = prices.get(wbtc_addr, 0)

    usdc_token = w3.eth.contract(address=usdc_addr, abi=ERC20_ABI)
    weth_token = w3.eth.contract(address=weth_addr, abi=ERC20_ABI)
    wbtc_token = w3.eth.contract(address=wbtc_addr, abi=ERC20_ABI)

    for pa_addr in pa_addresses:
        try:
            pa_addr = Web3.to_checksum_address(pa_addr)
            pa = w3.eth.contract(address=pa_addr, abi=TRADING_ACCOUNT_ABI)
            initial_capital = pa.functions.initialCapital().call()

            if initial_capital == 0:
                continue  # not yet funded

            usdc_bal = usdc_token.functions.balanceOf(pa_addr).call()
            weth_bal = weth_token.functions.balanceOf(pa_addr).call()
            wbtc_bal = wbtc_token.functions.balanceOf(pa_addr).call()

            # Compute portfolio value in USDC (6 decimals)
            weth_usdc = int((weth_bal / 1e18) * weth_price * 1e6) if weth_price else 0
            wbtc_usdc = int((wbtc_bal / 1e8) * wbtc_price * 1e6) if wbtc_price else 0
            total_value = usdc_bal + weth_usdc + wbtc_usdc

            threshold = initial_capital * 90 // 100  # 90% of initial (10% drawdown limit)
            drawdown_pct = (initial_capital - total_value) / initial_capital * 100 if initial_capital else 0

            print(
                f"[monitor_pa] {pa_addr} "
                f"usdc={usd6(usdc_bal)} weth_val={usd6(weth_usdc)} wbtc_val={usd6(wbtc_usdc)} "
                f"total={usd6(total_value)} init={usd6(initial_capital)} "
                f"drawdown={drawdown_pct:.2f}%"
            )

            if total_value < threshold:
                print(f"[monitor_pa] drawdown threshold breached for {pa_addr}, calling liquidate()")
                tx = pa.functions.liquidate(dex_router).build_transaction(
                    {
                        "from": acct.address,
                        "nonce": w3.eth.get_transaction_count(acct.address),
                        "gasPrice": w3.eth.gas_price,
                    }
                )
                tx["gas"] = w3.eth.estimate_gas(tx)
                signed = acct.sign_transaction(tx)
                tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
                print(f"[monitor_pa] liquidate sent: {tx_hash.hex()}")

        except Exception as e:
            print(f"[monitor_pa] error for PA {pa_addr}: {e}")


async def monitor():
    w3 = Web3(Web3.HTTPProvider(STATE_RPC, request_kwargs={"timeout": 10}))
    # Add POA middleware in case of testnet chain
    w3.middleware_onion.inject(geth_poa_middleware, layer=0)
    acct = w3.eth.account.from_key(ADMIN_KEY_RAW)
    contract = w3.eth.contract(address=Web3.to_checksum_address(PROP_CHALLENGE), abi=PROP_ABI)
    w3_price = Web3(Web3.HTTPProvider(PRICE_RPC, request_kwargs={"timeout": 10})) if PRICE_RPC else None

    print(f"[monitor] STATE_RPC={STATE_RPC}, contract={contract.address}, admin={acct.address}")
    while True:
        prices = fetch_chainlink_prices(w3_price) if w3_price else {}
        _latest_prices.update(prices)

        for trader in MONITORED_TRADERS:
            try:
                trader_addr = Web3.to_checksum_address(trader)
                eval_acc = contract.functions.getEvalAccount(trader_addr).call()
                virtual_balance = eval_acc[0]
                initial_balance = eval_acc[1]
                positions = contract.functions.getPositions(trader_addr).call()

                # equity = cash (virtualBalance) + mark-to-market value of open positions
                # matches frontend EvalStatus calculation
                open_positions_mtm = 0
                for p in positions:
                    if not p[5]:  # isOpen
                        continue
                    token_addr = Web3.to_checksum_address(p[0])
                    is_long = p[1]
                    size = int(p[2])          # USDC, 6 decimals
                    entry_price = int(p[3])   # 18 decimals

                    cur_price_usd = prices.get(token_addr)
                    if cur_price_usd and entry_price > 0:
                        # cur_price as 18-decimal int for ratio
                        cur_price_18 = int(cur_price_usd * 10**18)
                        if is_long:
                            mtm = size * cur_price_18 // entry_price
                        else:
                            mtm = max(0, 2 * size - size * cur_price_18 // entry_price)
                    else:
                        # 가격 없으면 진입 size 그대로 (보수적)
                        mtm = size
                    open_positions_mtm += mtm

                equity = virtual_balance + open_positions_mtm
                threshold = initial_balance * 90 // 100  # 90% of initial
                drawdown_pct = (initial_balance - equity) / initial_balance * 100 if initial_balance else 0

                eth_p = prices.get(Web3.to_checksum_address(WETH_ADDRESS)) if WETH_ADDRESS else None
                btc_p = prices.get(Web3.to_checksum_address(WBTC_ADDRESS)) if WBTC_ADDRESS else None
                price_str = f" | ETH=${eth_p:.2f} BTC=${btc_p:.2f}" if (eth_p and btc_p) else " | prices=unavailable"

                print(
                    f"[monitor] {trader_addr} "
                    f"cash={usd6(virtual_balance)} mtm={usd6(open_positions_mtm)} "
                    f"equity={usd6(equity)} init={usd6(initial_balance)} "
                    f"drawdown={drawdown_pct:.2f}%{price_str}"
                )

                if equity < threshold:
                    print(f"[monitor] threshold breached for {trader_addr}, sending failChallenge")
                    tx = contract.functions.failChallenge(trader_addr).build_transaction(
                        {
                            "from": acct.address,
                            "nonce": w3.eth.get_transaction_count(acct.address),
                            "gasPrice": w3.eth.gas_price,
                        }
                    )
                    tx["gas"] = w3.eth.estimate_gas(tx)
                    signed = acct.sign_transaction(tx)
                    tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
                    print(f"[monitor] failChallenge sent: {tx_hash.hex()}")
            except Exception as e:
                print(f"[monitor] error for trader {trader}: {e}")

        # Also monitor live PA accounts
        await monitor_pas(w3, prices, acct)

        await asyncio.sleep(MONITOR_INTERVAL)


async def handle_prices(request: web.Request) -> web.Response:
    """Return latest cached Chainlink prices as JSON."""
    eth_addr = Web3.to_checksum_address(WETH_ADDRESS) if WETH_ADDRESS else None
    btc_addr = Web3.to_checksum_address(WBTC_ADDRESS) if WBTC_ADDRESS else None
    payload = {
        "eth": _latest_prices.get(eth_addr, 0) if eth_addr else 0,
        "btc": _latest_prices.get(btc_addr, 0) if btc_addr else 0,
    }
    return web.Response(
        text=json.dumps(payload),
        content_type="application/json",
        headers={"Access-Control-Allow-Origin": "*"},
    )


async def run_api_server():
    app = web.Application()
    app.router.add_get("/prices", handle_prices)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", PRICE_API_PORT)
    await site.start()
    print(f"[monitor] Price API listening on http://0.0.0.0:{PRICE_API_PORT}/prices")


if __name__ == "__main__":
    async def main():
        await run_api_server()
        await monitor()

    asyncio.run(main())
