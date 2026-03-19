const SUPABASE_URL = 'https://jmjizeydpzdtqhedndyg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_54693a46643133646d6a697a657964707a6474716865646e647967';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const orderData = req.body;
        
        const response = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) throw new Error('Supabase save failed');
        
        const data = await response.json();
        res.status(200).json(data[0]);
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal Server Error', detail: error.message });
    }
}
