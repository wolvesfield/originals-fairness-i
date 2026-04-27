import subprocess
import json
import os

def query_closest_to_win(recent_bets, live_balance):
    """
    Calls the compiled TypeScript engine standalone bundle, 
    passing the live history and balance.
    The TypeScript script parses this with MarkovChainAnalyzer and 
    outputs the mathematically safest tiles and fractional Kelly wager.
    """
    data_payload = {
        "balance": live_balance,
        "recentBets": recent_bets
    }
    
    # Save temp data to file for TS process
    with open('temp_history.json', 'w') as f:
        json.dump(data_payload, f)
        
    try:
        # We execute the standalone bundle compiled via esbuild
        result = subprocess.run(
            ["node", "scripts/engine_bridge.bundle.cjs"],
            capture_output=True,
            text=True,
            check=True,
            shell=True
        )
        return json.loads(result.stdout.strip())
    except subprocess.CalledProcessError as e:
        print("[!] Engine Bridge Failed:", e.stderr)
        return None
    finally:
        if os.path.exists('temp_history.json'):
            os.remove('temp_history.json')
