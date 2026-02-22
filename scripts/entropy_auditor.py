import json
import math
import sqlite3
from pathlib import Path
from typing import Tuple


def load_crash_points(database_path: Path) -> list[float]:
    connection = sqlite3.connect(str(database_path))
    try:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT result_data
            FROM verified_seeds
            WHERE game_type = 'crash'
            """
        )
        rows = cursor.fetchall()
    finally:
        connection.close()

    crash_points: list[float] = []
    for (result_data_raw,) in rows:
        try:
            parsed = json.loads(result_data_raw)
        except json.JSONDecodeError:
            continue

        crash_value = parsed.get("crashPoint")
        if isinstance(crash_value, (int, float)):
            crash_points.append(float(crash_value))

    return crash_points


def chisquare_test(observed_crashes: int, total_games: int) -> Tuple[float, float]:
    expected_crashes = total_games / 33.0
    observed = [observed_crashes, total_games - observed_crashes]
    expected = [expected_crashes, total_games - expected_crashes]

    try:
        from scipy.stats import chisquare  # type: ignore

        statistic, p_value = chisquare(f_obs=observed, f_exp=expected)
        return float(statistic), float(p_value)
    except Exception:
        statistic = 0.0
        for obs, exp in zip(observed, expected):
            if exp > 0:
                statistic += (obs - exp) ** 2 / exp

        p_value = math.erfc(math.sqrt(statistic / 2.0))
        return float(statistic), float(p_value)


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    db_path = repo_root / "database" / "audit_store.db"

    crash_points = load_crash_points(db_path)
    total_games = len(crash_points)
    observed_crashes = sum(1 for value in crash_points if abs(value - 1.0) < 1e-12)
    expected_crashes = total_games / 33.0

    chi_square_statistic, p_value = chisquare_test(observed_crashes, total_games)

    result = {
        "total_games": int(total_games),
        "observed_crashes": int(observed_crashes),
        "expected_crashes": float(expected_crashes),
        "chi_square_statistic": float(chi_square_statistic),
        "p_value": float(p_value),
    }

    print(json.dumps(result, separators=(",", ":")))


if __name__ == "__main__":
    main()
