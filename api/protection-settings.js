const SUPABASE_URL = 'https://jmjizeydpzdtqhedndyg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_54693a46643133646d6a697a657964707a6474716865646e647967'; // Using public key for proxy if service role not available

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
