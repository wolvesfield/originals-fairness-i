import hashlib
import hmac
import json
import os
import sqlite3
import asyncio
from typing import Any, Dict, Iterable, List, Optional

import requests
import concurrent.futures
import math
import socketio


def generate_game_hash(server_seed: str, client_seed: str, nonce: int, round: int = 0) -> str:
    """
    Stake/Roobet provably fair hash:
    HMAC_SHA256(key=server_seed, message=f"{client_seed}:{nonce}:{round}")
    """
    payload = f"{client_seed}:{nonce}:{round}"
    digest = hmac.new(server_seed.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256)
    return digest.hexdigest()


def decode_crash(server_seed: str, client_seed: str, nonce: int, round: int = 0) -> float:
    game_hash = generate_game_hash(server_seed, client_seed, nonce, round)
    h = int(game_hash[:13], 16)
    if h % 33 == 0:
        return 1.0
    denom = (2**52) - h
    if denom <= 0:
        return 1.0
    return (2**52 / denom) * 0.99


def decode_mines(server_seed: str, client_seed: str, nonce: int, mine_count: int, round: int = 0) -> List[int]:
    game_hash = generate_game_hash(server_seed, client_seed, nonce, round)
    mines: List[int] = []
    for i in range(0, len(game_hash), 2):
        if len(mines) >= mine_count:
            break
        byte_val = int(game_hash[i:i + 2], 16)
        position = byte_val
        if position < 25 and position not in mines:
            mines.append(position)
    return mines


def decode_keno(server_seed: str, client_seed: str, nonce: int, round: int = 0) -> List[int]:
    game_hash = generate_game_hash(server_seed, client_seed, nonce, round)
    bytes_seq = [int(game_hash[i:i + 2], 16) for i in range(0, len(game_hash), 2)]
    numbers = list(range(1, 81))
    byte_index = 0
    for i in range(len(numbers) - 1, 0, -1):
        byte_val = bytes_seq[byte_index % len(bytes_seq)]
        swap_idx = byte_val % (i + 1)
        numbers[i], numbers[swap_idx] = numbers[swap_idx], numbers[i]
        byte_index += 1
    return numbers[:20]


def simulate_seed_impact(game_type: str, server_seed: str, target_outcome: Any, nonce: int = 0, round: int = 0) -> str:
    distribution: Dict[str, int] = {}
    matches: List[str] = []

    for i in range(1000):
        client_seed = f"seed-{i}"
        if game_type == "crash":
            outcome = decode_crash(server_seed, client_seed, nonce, round)
            key = f"{outcome:.2f}"
            if math.isclose(outcome, target_outcome, rel_tol=1e-9, abs_tol=1e-9):
                matches.append(client_seed)
        elif game_type == "mines":
            mine_count = len(target_outcome) if isinstance(target_outcome, list) else 3
            outcome = decode_mines(server_seed, client_seed, nonce, mine_count, round)
            key = ",".join(map(str, outcome))
            if isinstance(target_outcome, list) and sorted(outcome) == sorted(target_outcome):
                matches.append(client_seed)
        else:
            outcome = decode_keno(server_seed, client_seed, nonce, round)
            key = ",".join(map(str, outcome))
            if isinstance(target_outcome, list) and outcome == target_outcome:
                matches.append(client_seed)

        distribution[key] = distribution.get(key, 0) + 1

    result = {
        "game_type": game_type,
        "total_seeds": 1000,
        "distribution": distribution,
        "matches": matches,
    }
    payload_str = json.dumps(result)
    _persist_latest_audit_state(payload_str)
    _maybe_emit_state(payload_str)
    _maybe_trigger_anomaly_alert(result)
    return payload_str


def hash_cracking(target_hash: str) -> Dict[str, Any]:
    def _search() -> Dict[str, Any]:
        prefix = target_hash[:8]
        for i in range(1_000_000):
            candidate = f"candidate-{i}".encode("utf-8")
            attempt = hashlib.sha256(candidate).hexdigest()
            if attempt.startswith(prefix):
                return {"status": "found", "value": candidate.decode("utf-8"), "hash": attempt}
        return {"status": "not_found"}

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_search)
        try:
            return future.result(timeout=15)
        except concurrent.futures.TimeoutError:
            return {"status": "timeout"}


def verify_merkle_proof(leaf: str, proof_array: List[str], root_hash: str) -> bool:
    current = hashlib.sha256(leaf.encode("utf-8")).hexdigest()
    for sibling in proof_array:
        pair = "".join(sorted([current, sibling]))
        current = hashlib.sha256(pair.encode("utf-8")).hexdigest()
    return current == root_hash


def _persist_latest_audit_state(payload: str, db_path: str = "baseline.db") -> None:
    try:
        conn = init_baseline_db(db_path)
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO Meta(key, value) VALUES('latest_audit_state', ?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
            """,
            (payload,),
        )
        conn.commit()
        conn.close()
    except Exception:
        return


def _maybe_emit_state(payload: str) -> None:
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    loop.create_task(sio.emit("state_update", payload))


async def fire_discord_alert(payload: Dict[str, Any]) -> None:
    webhook = os.getenv("DISCORD_WEBHOOK_URL")
    if not webhook:
        return
    try:
        requests.post(webhook, json={"content": json.dumps(payload)})
    except Exception:
        return


def _maybe_trigger_anomaly_alert(result: Dict[str, Any]) -> None:
    distribution = result.get("distribution", {})
    total = result.get("total_seeds", 0) or 0
    if not distribution or total <= 0:
        return
    expected = 1 / len(distribution)
    for key, count in distribution.items():
        observed = count / total
        if abs(observed - expected) > expected * 0.15:
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(
                    fire_discord_alert(
                        {
                            "severity": "CRITICAL_ANOMALY",
                            "game_type": result.get("game_type"),
                            "distribution_key": key,
                            "observed": observed,
                            "expected": expected,
                            "matches": result.get("matches", []),
                        }
                    )
                )
            except RuntimeError:
                return
            break


class StakeIngestionClient:
    def __init__(self, token: Optional[str] = None, base_url: str = "https://api.stake.com/api") -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token or os.getenv("STAKE_API_TOKEN")
        if not self.token:
            raise ValueError("STAKE_API_TOKEN is required for authenticated ingestion")
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"Bearer {self.token}",
                "Accept": "application/json",
                "User-Agent": "originals-fairness-ingestor/1.0",
            }
        )

    def fetch_bet_history(self, limit: int = 100, page: int = 1, timeout: int = 10) -> List[Dict[str, Any]]:
        """
        Pull bet history for the authenticated user.
        Endpoint path may need alignment with Stake's official API surface.
        """
        url = f"{self.base_url}/bets"
        params = {"limit": limit, "page": page}
        response = self.session.get(url, params=params, timeout=timeout)
        response.raise_for_status()
        payload = response.json()
        # Expecting payload format: {"data": [...]} – adjust if API differs.
        if isinstance(payload, dict) and "data" in payload:
            return payload["data"]  # type: ignore[return-value]
        if isinstance(payload, list):
            return payload
        raise ValueError("Unexpected bet history response structure")


def init_baseline_db(db_path: str = "baseline.db") -> sqlite3.Connection:
    """
    Initialize SQLite schema for Seeds, Bets, Anomalies, and meta checksum storage.
    """
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS Seeds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_seed_hash TEXT NOT NULL,
            client_seed TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS Bets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nonce INTEGER NOT NULL,
            round INTEGER DEFAULT 0,
            game_hash TEXT NOT NULL,
            payload TEXT NOT NULL,
            raw JSON,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS Anomalies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nonce INTEGER,
            reason TEXT NOT NULL,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS Meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()
    return conn


def _checksum_from_bets(bets: Iterable[Dict[str, Any]]) -> str:
    material = json.dumps(sorted(bets, key=lambda b: json.dumps(b, sort_keys=True)), separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def record_baseline(conn: sqlite3.Connection, bets: List[Dict[str, Any]]) -> str:
    """
    Persist baseline bets and return checksum. Assumes baseline pull is the gold standard.
    """
    cur = conn.cursor()
    for bet in bets:
        nonce = bet.get("nonce") or 0
        round_no = bet.get("round") or 0
        payload = bet.get("payload") or ""
        game_hash = bet.get("hash") or bet.get("game_hash") or ""
        cur.execute(
            """
            INSERT INTO Bets (nonce, round, game_hash, payload, raw)
            VALUES (?, ?, ?, ?, ?)
            """,
            (nonce, round_no, game_hash, json.dumps(payload), json.dumps(bet)),
        )
    checksum = _checksum_from_bets(bets)
    cur.execute(
        """
        INSERT INTO Meta(key, value) VALUES('baseline_checksum', ?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
        """,
        (checksum,),
    )
    conn.commit()
    return checksum


def ingest_and_baseline(db_path: str = "baseline.db", limit: int = 100) -> str:
    """
    Run authenticated ingestion and record the first pull as the gold baseline checksum.
    """
    client = StakeIngestionClient()
    conn = init_baseline_db(db_path)
    bets = client.fetch_bet_history(limit=limit)
    return record_baseline(conn, bets)

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
socket_app = socketio.ASGIApp(sio)
