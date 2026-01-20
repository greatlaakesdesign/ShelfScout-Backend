import crypto from 'crypto';

function hmacSha1(key, message) {
  return crypto.createHmac('sha1', key).update(message).digest();
}

function percentEncode(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function generateSignature(httpMethod, baseUrl, params, consumerSecret) {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys
    .map(key => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&');

  const signatureBaseString = [
    httpMethod.toUpperCase(),
    percentEncode(baseUrl),
    percentEncode(paramString)
  ].join('&');

  const signingKey = consumerSecret + '&';
  const signature = hmacSha1(signingKey, signatureBaseString);

  return signature.toString('base64');
}

async function searchFatSecret(query, consumerKey, consumerSecret) {
  const apiUrl = 'https://platform.fatsecret.com/rest/server.api';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2, 15) +
                Math.random().toString(36).substring(2, 15);

  const params = {
    format: 'json',
    max_results: '20',
    method: 'foods.search',
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_version: '1.0',
    search_expression: query,
  };

  const signature = generateSignature('GET', apiUrl, params, consumerSecret);
  params.oauth_signature = signature;

  const queryString = Object.keys(params)
    .sort()
    .map(key => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&');

  const requestUrl = `${apiUrl}?${queryString}`;

  try {
    const response = await fetch(requestUrl, { method: 'GET' });
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'FatSecret API error');
    }

    if (!data.foods?.food) {
      return { foods: [], error: null };
    }

    const foods = Array.isArray(data.foods.food) ? data.foods.food : [data.foods.food];
    return { foods: foods.slice(0, 20), error: null };
  } catch (error) {
    return { foods: [], error: error.message };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const consumerKey = process.env.FATSECRET_CONSUMER_KEY;
  const consumerSecret = process.env.FATSECRET_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    return res.status(500).json({ error: 'Backend API keys not configured' });
  }

  const { barcode, search } = req.body;

  if (!barcode && !search) {
    return res.status(400).json({ error: 'Provide either barcode or search query' });
  }

  const query = barcode || search;

  try {
    const { foods, error } = await searchFatSecret(query, consumerKey, consumerSecret);

    if (error) {
      return res.status(500).json({ error: `FatSecret error: ${error}` });
    }

    if (foods.length === 0) {
      return res.status(404).json({ error: 'Food not found' });
    }

    const food = foods[0];
    return res.status(200).json({
      barcode: barcode || search,
      name: food.food_name || 'Unknown',
      brand: food.brand_name || 'FatSecret',
      calories: Math.round(food.calories || 0),
      protein: Math.round((food.protein || 0) * 10) / 10,
      carbohydrates: Math.round((food.carbohydrate || 0) * 10) / 10,
      fat: Math.round((food.fat || 0) * 10) / 10,
      servingSize: food.serving_size ? `${food.serving_size} ${food.serving_unit || 'g'}` : '100g',
      source: 'fatsecret',
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
