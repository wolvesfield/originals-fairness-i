#!/usr/bin/env python3
"""
Stake.com GraphQL Audit Script
-------------------------------
Queries the Stake.com GraphQL API for:
  1. User balances (all currencies)
  2. Active server/client seed pair + nonce
  3. Recent bet history with server seed hashes

Usage:
  python scripts/stake_audit.py
  python scripts/stake_audit.py --token YOUR_TOKEN
  python scripts/stake_audit.py --limit 100

Requires:
  pip install requests
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: 'requests' not installed. Run: pip install requests")
    sys.exit(1)

# ── Default credentials (override via --token flag) ──
DEFAULT_TOKEN = (
    "cf3f4d5a42f40a19ad83c94c285826a8d62d003f24260e6aa46f732bb2f681a434bacc48441c27824ab6c434776736e9"
)

STAKE_GRAPHQL = "https://stake.com/_api/graphql"

# Browser-mimicking headers (required to bypass Cloudflare)
HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/graphql+json, application/json",
    "Origin": "https://stake.com",
    "Referer": "https://stake.com/",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/145.0.0.0 Safari/537.36"
    ),
    "sec-ch-ua": '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-language": "en",
}


def graphql_query(token: str, query: str, variables: dict = None, operation: str = None):
    """Execute a GraphQL query against Stake.com."""
    headers = {**HEADERS, "x-access-token": token}
    if operation:
        headers["x-operation-name"] = operation

    payload = {"query": query}
    if variables:
        payload["variables"] = variables

    resp = requests.post(STAKE_GRAPHQL, json=payload, headers=headers, timeout=15)

    if resp.status_code == 403:
        body = resp.text[:500]
        if "cloudflare" in body.lower() or "cf-" in body.lower():
            raise RuntimeError(
                "403 Cloudflare block — your IP/headers are being fingerprinted. "
                "Try running from a different network or using a VPN."
            )
        raise RuntimeError(f"403 Forbidden — token may be expired. Response: {body}")

    resp.raise_for_status()
    data = resp.json()

    if "errors" in data and data["errors"]:
        msgs = "; ".join(e.get("message", str(e)) for e in data["errors"])
        raise RuntimeError(f"GraphQL errors: {msgs}")

    return data.get("data", {})


def fetch_balances(token: str) -> list:
    """Fetch all user balances."""
    query = """query UserBalances {
        user {
            name
            balances {
                available { amount currency { name ticker } }
            }
        }
    }"""
    data = graphql_query(token, query, operation="UserBalances")
    user = data.get("user", {})
    name = user.get("name", "unknown")
    balances = user.get("balances", {}).get("available", [])

    print(f"\n{'='*50}")
    print(f"  User: {name}")
    print(f"{'='*50}")
    print(f"  {'Currency':<10} {'Balance':>15}")
    print(f"  {'-'*25}")

    results = []
    for bal in balances:
        amount = float(bal.get("amount", 0))
        if amount <= 0:
            continue
        ticker = bal.get("currency", {}).get("ticker", "???")
        cname = bal.get("currency", {}).get("name", ticker)
        print(f"  {ticker:<10} {amount:>15.8f}")
        results.append({"currency": cname, "ticker": ticker, "amount": amount})

    if not results:
        print("  (no non-zero balances)")

    return results


def fetch_active_seed(token: str) -> dict:
    """Fetch the active server/client seed pair and nonce."""
    query = """query ActiveCasinoSeed {
        user {
            activeServerSeed { seedHash nonce }
            activeClientSeed { seed }
            previousServerSeed { seed seedHash nonce }
        }
    }"""
    data = graphql_query(token, query, operation="ActiveCasinoSeed")
    user = data.get("user", {})

    active_server = user.get("activeServerSeed", {})
    active_client = user.get("activeClientSeed", {})
    prev_server = user.get("previousServerSeed", {})

    seed_hash = active_server.get("seedHash", "N/A")
    nonce = active_server.get("nonce", 0)
    client_seed = active_client.get("seed", "N/A")
    prev_seed = prev_server.get("seed", "N/A")
    prev_hash = prev_server.get("seedHash", "N/A")
    prev_nonce = prev_server.get("nonce", 0)

    print(f"\n{'='*50}")
    print("  Active Seed Pair")
    print(f"{'='*50}")
    print(f"  Server Seed Hash : {seed_hash}")
    print(f"  Client Seed      : {client_seed}")
    print(f"  Current Nonce    : {nonce}")
    print(f"  ---")
    print(f"  Previous Server  : {prev_seed[:40]}..." if len(prev_seed) > 40 else f"  Previous Server  : {prev_seed}")
    print(f"  Previous Hash    : {prev_hash}")
    print(f"  Previous Nonce   : {prev_nonce}")

    return {
        "serverSeedHash": seed_hash,
        "clientSeed": client_seed,
        "nonce": nonce,
        "previousServerSeed": prev_seed,
        "previousServerSeedHash": prev_hash,
        "previousNonce": prev_nonce,
    }


def fetch_bet_history(token: str, limit: int = 50) -> list:
    """Fetch recent bet history with seed data."""
    query = """query CasinoBets($offset: Int, $limit: Int) {
        user {
            houseBetList(offset: $offset, limit: $limit) {
                id
                nonce
                createdAt
                payout
                payoutMultiplier
                game { slug name }
                serverSeed { seedHash seed }
                clientSeed { seed }
            }
        }
    }"""
    data = graphql_query(token, query, variables={"offset": 0, "limit": limit}, operation="CasinoBets")
    bets = data.get("user", {}).get("houseBetList", [])

    print(f"\n{'='*50}")
    print(f"  Recent Bets ({len(bets)} results)")
    print(f"{'='*50}")
    print(f"  {'#':<5} {'Game':<12} {'Nonce':<8} {'Payout':<10} {'Server Hash':<20} {'Revealed?'}")
    print(f"  {'-'*70}")

    results = []
    for i, bet in enumerate(bets):
        game = bet.get("game", {}).get("slug", "?")
        nonce = bet.get("nonce", "?")
        payout = bet.get("payoutMultiplier", "?")
        seed_hash = bet.get("serverSeed", {}).get("seedHash", "")[:16]
        revealed = bet.get("serverSeed", {}).get("seed", "")
        has_revealed = "YES" if revealed else "no"

        if isinstance(payout, (int, float)):
            payout_str = f"{payout:.2f}x"
        else:
            payout_str = str(payout)

        print(f"  {i+1:<5} {game:<12} {str(nonce):<8} {payout_str:<10} {seed_hash}... {has_revealed}")

        results.append({
            "game": game,
            "nonce": nonce,
            "payout": payout,
            "serverSeedHash": bet.get("serverSeed", {}).get("seedHash", ""),
            "revealedServerSeed": revealed or None,
            "clientSeed": bet.get("clientSeed", {}).get("seed", ""),
            "createdAt": bet.get("createdAt", ""),
        })

    return results


def main():
    parser = argparse.ArgumentParser(description="Stake.com GraphQL Audit Tool")
    parser.add_argument("--token", default=DEFAULT_TOKEN, help="Stake.com x-access-token")
    parser.add_argument("--limit", type=int, default=50, help="Number of bets to fetch (default: 50)")
    parser.add_argument("--json", action="store_true", help="Output raw JSON instead of formatted text")
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Write structured JSON to file (default: data/stake_audit_<timestamp>.json)",
    )
    args = parser.parse_args()

    token = args.token
    timestamp = datetime.now().isoformat()

    print(f"\n🎰 Stake.com Audit — {timestamp}")
    print(f"   Token: {token[:8]}...{token[-8:]}")

    try:
        balances = fetch_balances(token)
        seeds = fetch_active_seed(token)
        bets = fetch_bet_history(token, args.limit)

        # Build structured output for downstream ingestion
        output = {
            "timestamp": timestamp,
            "balances": balances,
            "activeSeed": seeds,
            "betHistory": bets,
        }

        if args.json:
            print("\n" + json.dumps(output, indent=2))

        # Write JSON file for StochasticEngine / Monte Carlo ingestion
        out_path = args.output
        if out_path is None:
            safe_ts = timestamp.replace(":", "-").replace(".", "-")
            out_dir = Path(__file__).resolve().parent.parent / "data"
            out_path = str(out_dir / f"stake_audit_{safe_ts}.json")
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2)
        print(f"\n📁 JSON exported → {out_path}")

        print(f"\n✅ Audit complete — {len(bets)} bets retrieved, {len(balances)} non-zero balances")

    except RuntimeError as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)
    except requests.exceptions.RequestException as e:
        print(f"\n❌ Network error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
