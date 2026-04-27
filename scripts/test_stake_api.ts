const token = 'ef78609e98ebc55d173b4df8d16d9b4c1c8ef7283ff8a8be9074d645b1d25068b4216bd1ea800239681d1f824740c381';

async function testApi() {
  const headers = {
    'x-access-token': token,
    'content-type': 'application/json',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'accept': '*/*',
    'origin': 'https://stake.com',
    'referer': 'https://stake.com/',
    'accept-language': 'en-US,en;q=0.9',
    'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
  };

  try {
    const response = await fetch('https://stake.com/_api/graphql', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: 'query { user { id name balances { available { amount currency } } } }'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Success:', JSON.stringify(data, null, 2));
    } else {
      console.log('Failed:', response.status, response.statusText);
      const text = await response.text();
      console.log('Body snippet:', text.substring(0, 300));
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

testApi();
