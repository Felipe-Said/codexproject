const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/admin_settings?id=eq.1&select=*`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        if (!response.ok) throw new Error('Supabase fetch failed');
        
        const data = await response.json();
        const settings = data[0] || {};
        
        // Ensure consistent structure
        if (typeof settings.protected_pages === 'string') {
            settings.protected_pages = JSON.parse(settings.protected_pages);
        }

        res.status(200).json(settings);
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal Server Error', detail: error.message });
    }
}
