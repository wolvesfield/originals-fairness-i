import cloudscraper
import json

scraper = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False})
token = 'ef78609e98ebc55d173b4df8d16d9b4c1c8ef7283ff8a8be9074d645b1d25068b4216bd1ea800239681d1f824740c381'

headers = {
    'x-access-token': token,
    'content-type': 'application/json'
}

payload = {
    'operationName': 'MinesBet',
    'variables': {
        'currency': 'sol',
        'amount': 0.000001, # Standard crypto minimum
        'fields': [3, 4], # We will pick tiles [3] and [4]
        'minesCount': 3
    },
    'query': """
    mutation MinesBet($currency: CurrencyEnum!, $amount: Float!, $fields: [Int!]!, $minesCount: Int!) {
      minesBet(currency: $currency, amount: $amount, fields: $fields, minesCount: $minesCount) {
        id 
        payout 
        state {
            ... on CasinoGameMines {
                minesCount
                rounds {
                    field
                    payoutMultiplier
                }
            }
        }
      }
    }
    """
}

response = scraper.post('https://stake.com/_api/graphql', json=payload, headers=headers)
print('MinesBet Mutation Test Response:')
try:
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print(response.text[:1000])
