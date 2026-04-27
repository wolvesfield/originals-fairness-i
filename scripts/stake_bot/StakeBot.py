import time
import random
import json
import cloudscraper

class StakeBot:
    def __init__(self, token, starting_balance, currency='sol'):
        self.token = token
        self.base_url = "https://stake.com/_api/graphql"
        self.scraper = cloudscraper.create_scraper(
            browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False}
        )
        self.headers = {
            'x-access-token': self.token,
            'content-type': 'application/json',
            'origin': 'https://stake.com',
            'referer': 'https://stake.com/'
        }
        
        # Precision Settings
        self.currency = currency
        self.starting_balance = starting_balance
        self.current_balance = starting_balance
        self.max_profit_target = starting_balance * 1.5  # 50% profit target
        self.stop_loss_target = starting_balance * 0.75  # 25% stop loss
        
        self.consecutive_losses = 0
        self.total_bets = 0
        
    def _execute_graphql(self, payload):
        for _ in range(3):
            try:
                response = self.scraper.post(self.base_url, json=payload, headers=self.headers, timeout=10)
                if response.status_code == 200:
                    return response.json()
                elif response.status_code in [403, 429]:
                    print(f"[!] Rate Limited (Code: {response.status_code}). Sleeping for 10 seconds...")
                    time.sleep(10)
                else:
                    print(f"Error {response.status_code}: {response.text[:100]}")
                    return None
            except Exception as e:
                print(f"[!] Request Exception: {e}")
                time.sleep(3)
        return None

    def fetch_live_balance(self):
        """Fetches live balance to drive fractional Kelly compounding."""
        payload = {'query': 'query { user { balances { available { amount currency } } } }'}
        data = self._execute_graphql(payload)
        
        if data and 'data' in data and 'user' in data['data']:
            for b in data['data']['user']['balances']:
                if b['available']['currency'] == self.currency:
                    print(f"[*] Live Balance Updated: {b['available']['amount']} {self.currency.upper()}")
                    self.current_balance = b['available']['amount']
                    return self.current_balance
        return self.current_balance

    def check_breakers(self):
        """Validates Stop-Loss and Take-Profit limits."""
        if self.current_balance >= self.max_profit_target:
            print(f"\n[$$$] TAKE PROFIT REACHED! Balance: {self.current_balance}. Bot Halting.")
            return True # Should halt
        elif self.current_balance <= self.stop_loss_target:
            print(f"\n[!!!] STOP LOSS SURPASSED! Balance: {self.current_balance}. Bot Halting to prevent tilt.")
            return True
        return False

    def humanized_delay(self):
        """Adaptive Jitter to simulate human clicking and avoid WAF bot-detection."""
        base_delay = random.uniform(0.8, 2.5) # 800ms to 2500ms
        
        # If on a losing streak, add "frustration/cool-off" delay
        if self.consecutive_losses >= 3:
            penalty = random.uniform(3.0, 7.0)
            print(f"[*] Losing streak detected. Adding human cool-off delay of {penalty:.2f}s...")
            base_delay += penalty
            
        print(f"[-] Waiting {base_delay:.2f}s...")
        time.sleep(base_delay)

    def rotate_client_seed(self):
        """Rotates the client seed if EV degrades."""
        print("[*] Automatically rotating Client Seed to break variance cluster...")
        new_seed = ''.join(random.choices('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=10))
        
        payload = {
            "operationName": "RotateSeedPair",
            "variables": {
                "seed": new_seed
            },
            "query": "mutation RotateSeedPair($seed: String!) { rotateSeedPair(seed: $seed) { clientSeed { seed } serverSeed { hash } } }"
        }
        res = self._execute_graphql(payload)
        if res and 'data' in res:
            print(f"[+] Successfully rotated Client Seed to: {new_seed}")
        else:
            print("[-] Failed to rotate seed.")

    def calculate_kelly_bet(self, confidence, payout_multiplier):
        """
        Fractional Kelly Criterion:
        f* = (bp - q) / b
        Where b is the net odds (multiplier - 1)
        p is probability of winning
        q is probability of losing (1 - p)
        """
        b = payout_multiplier - 1
        p = confidence
        q = 1 - p
        
        fraction = (b * p - q) / b
        
        # Cap aggressive betting (Fractional Kelly mapping)
        if fraction <= 0:
            return min(0.0001, self.current_balance * 0.001) # Minimum safety bet
            
        fraction = fraction * 0.10 # Quarter/Tenth Kelly for extreme safety
        
        # Never bet more than 2% of bankroll flat
        fraction = min(fraction, 0.02)
        
        bet_size = self.current_balance * fraction
        return round(bet_size, 8)

    def run_dry_loop(self, iterations=5):
        """Simulates the bot logic without placing real bets."""
        print(f"\n=== STARTING STAKE AUTO-BOT (DRY RUN) ===")
        print(f"Currency: {self.currency.upper()}")
        print(f"Starting Balance: {self.starting_balance}")
        print(f"Take Profit Limit: {self.max_profit_target}")
        print(f"Stop Loss Limit: {self.stop_loss_target}")
        print(f"=========================================\n")
        
        for i in range(iterations):
            self.total_bets += 1
            print(f"\n--- Round {self.total_bets} ---")
            
            # 1. Update Balance
            self.fetch_live_balance()
            
            # 2. Check Breakers
            if self.check_breakers():
                break
                
            # 3. Request TS Engine Prediction via py_bridge
            from py_bridge import query_closest_to_win
            
            # Pass dummy history for now, but in reality this is the parsed Stake bets
            engine_output = query_closest_to_win([], self.current_balance)
            
            if engine_output:
                simulated_confidence = engine_output['confidence']
                simulated_multiplier = engine_output['multiplier']
                
                # ClosestToWin Engine targets (e.g. [1, 5, 24])
                target_tiles = [t for t, is_target in enumerate(engine_output['targetTiles']) if is_target]
            else:
                simulated_confidence = 0.80
                simulated_multiplier = 1.3
                target_tiles = [0, 1, 2]
            
            # 4. Calculate Kelly Wager based on live balance
            bet_amount = self.calculate_kelly_bet(simulated_confidence, simulated_multiplier)
            
            print(f"[>] Strategy Engine -> Confidence: {simulated_confidence:.1%}, Target Tiles: {target_tiles}")
            print(f"[>] Fractional Kelly implies wager: {bet_amount:.8f} {self.currency.upper()}")
            
            # 5. Simulate outcome (for testing loop)
            win = random.random() < simulated_confidence
            if win:
                profit = bet_amount * (simulated_multiplier - 1)
                self.current_balance += profit
                self.consecutive_losses = 0
                print(f"[+] SIMULATED WIN: +{profit:.8f} {self.currency.upper()}")
            else:
                self.current_balance -= bet_amount
                self.consecutive_losses += 1
                print(f"[-] SIMULATED LOSS: -{bet_amount:.8f} {self.currency.upper()}")
                
                if self.consecutive_losses >= 4:
                    self.rotate_client_seed()
            
            # 6. Anti-Ban Delay
            self.humanized_delay()

if __name__ == "__main__":
    import os
    token = os.getenv("STAKE_TOKEN", "ef78609e98ebc55d173b4df8d16d9b4c1c8ef7283ff8a8be9074d645b1d25068b4216bd1ea800239681d1f824740c381")
    
    # Initialize with token and starting balance. We use a known balance from earlier fetch.
    bot = StakeBot(token, starting_balance=0.0147, currency='sol')
    
    # Execute a safe Dry Run
    bot.run_dry_loop(iterations=5)
