const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

function sanitizeOrderPayload(body) {
    return {
        customer_name: String(body.customer_name || '').trim(),
        address: String(body.address || '').trim(),
        city: String(body.city || '').trim(),
        zip: String(body.zip || '').trim(),
        phone: String(body.phone || '').trim(),
        product_name: String(body.product_name || '').trim(),
        product_image: String(body.product_image || '').trim(),
        value: String(body.value || '').trim(),
        status: String(body.status || 'Pendente').trim(),
        campaign_id: String(body.campaign_id || 'Organic').trim()
    };
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'Supabase server environment is not configured.' });
    }

    try {
        const orderData = sanitizeOrderPayload(req.body || {});

        if (!orderData.customer_name || !orderData.address || !orderData.city || !orderData.zip || !orderData.phone || !orderData.product_name || !orderData.value) {
            return res.status(400).json({ error: 'Missing required order fields.' });
        }

        const response = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(orderData)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data && data.message ? data.message : 'Supabase save failed');
        }

        res.status(200).json(data[0] || orderData);
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal Server Error', detail: error.message });
    }
}
