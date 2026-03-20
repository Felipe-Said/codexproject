const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

async function readAdminSettings() {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return {};

    const response = await fetch(`${SUPABASE_URL}/rest/v1/admin_settings?id=eq.1&select=*`, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
    });

    if (!response.ok) return {};
    const data = await response.json();
    return data[0] || {};
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const settings = await readAdminSettings();
        const gatewayActive = process.env.ACTIVE_GATEWAY || settings.gateway_active || settings.active_gateway || 'none';
        const stripePublicKey = process.env.STRIPE_PUBLIC_KEY || settings.stripe_public_key || settings.stripePubKey || '';
        const whopBizId = process.env.WHOP_BIZ_ID || settings.whop_biz_id || settings.whopBizId || '';

        res.status(200).json({
            gatewayActive,
            stripePublicKey,
            whopBizId
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal Server Error', detail: error.message });
    }
}
