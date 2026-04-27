import cloudscraper
import json
import time

class StakeClient:
    def __init__(self, token):
        self.token = token
        self.base_url = "https://stake.com/_api/graphql"
        self.scraper = cloudscraper.create_scraper(
            browser={
                'browser': 'chrome',
                'platform': 'windows',
                'mobile': False
            }
        )
        self.headers = {
            'x-access-token': self.token,
            'content-type': 'application/json',
            'origin': 'https://stake.com',
            'referer': 'https://stake.com/'
        }

    def _post(self, payload):
        """Internal method to handle POST requests with simple retry logic."""
        for _ in range(3):
            try:
                response = self.scraper.post(self.base_url, json=payload, headers=self.headers, timeout=10)
                if response.status_code == 200:
                    return response.json()
                elif response.status_code in [403, 429]:
                    print(f"Got {response.status_code}, sleeping to avoid rate limit...")
                    time.sleep(5)
                else:
                    print(f"Error {response.status_code}: {response.text[:200]}")
                    return None
            except Exception as e:
                print(f"Request failed: {e}")
                time.sleep(2)
        return None

    def get_balances(self):
        """Fetch available balances for the user."""
        payload = {
            'query': 'query { user { id name balances { available { amount currency } } } }'
        }
        data = self._post(payload)
        if data and 'data' in data and 'user' in data['data']:
            balances = data['data']['user']['balances']
            return {b['available']['currency']: b['available']['amount'] for b in balances if b['available']['amount'] > 0}
        return {}

    def get_recent_mines_bets(self, limit=10):
        """Fetch the most recent casino bets for the user."""
        # Note: exact structure depends on Stake's GraphQL schema for user bets.
        # This uses a generic casino bets query.
        payload = {
            "operationName": "UserBets",
            "variables": {
                "limit": limit,
                "offset": 0
            },
            "query": "query UserBets($limit: Int, $offset: Int) { user { id casinoBets(limit: $limit, offset: $offset) { id iid game { name } amount payout multiplier state createdAt clientSeed { seed } serverSeed { seed hash } } } }"
        }
        data = self._post(payload)
        return data

if __name__ == "__main__":
    import os
    # For testing ONLY. Do not push tokens to Git.
    token = os.getenv("STAKE_TOKEN", "ef78609e98ebc55d173b4df8d16d9b4c1c8ef7283ff8a8be9074d645b1d25068b4216bd1ea800239681d1f824740c381")
    client = StakeClient(token)
    
    print("Fetching balances...")
    balances = client.get_balances()
    print(json.dumps(balances, indent=2))
    
    print("\nFetching recent bets...")
    bets = client.get_recent_mines_bets(3)
    print(json.dumps(bets, indent=2))
