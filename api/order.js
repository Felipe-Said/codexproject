const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'Supabase server environment is not configured.' });
    }

    const id = req.query && req.query.id ? String(req.query.id).trim() : '';
    if (!id) {
        return res.status(400).json({ error: 'Order id is required.' });
    }

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(id)}&select=*`, {
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data && data.message ? data.message : 'Supabase fetch failed');
        }

        if (!data[0]) {
            return res.status(404).json({ error: 'Order not found.' });
        }

        res.status(200).json(data[0]);
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal Server Error', detail: error.message });
    }
}
