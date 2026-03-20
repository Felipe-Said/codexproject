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

async function fetchOrder(id) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(id)}&select=*`, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data && data.message ? data.message : 'Failed to load order');
    }

    return data[0] || null;
}

async function updateOrderStatus(id, status) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({ status })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data && data.message ? data.message : 'Failed to update order status');
    }

    return data[0] || null;
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'Supabase server environment is not configured.' });
    }

    const orderId = req.query && req.query.order_id ? String(req.query.order_id).trim() : '';
    const sessionId = req.query && req.query.session_id ? String(req.query.session_id).trim() : '';

    if (!orderId || !sessionId) {
        return res.status(400).json({ error: 'order_id and session_id are required.' });
    }

    try {
        const settings = await readAdminSettings();
        const stripeSecretKey = process.env.STRIPE_SECRET_KEY || settings.stripe_secret_key || settings.stripeSecKey || '';

        if (!stripeSecretKey) {
            return res.status(500).json({ error: 'Stripe is not configured on the server.' });
        }

        const stripeResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
            headers: {
                'Authorization': `Bearer ${stripeSecretKey}`
            }
        });

        const session = await stripeResponse.json();
        if (!stripeResponse.ok) {
            throw new Error(session && session.error && session.error.message ? session.error.message : 'Stripe session lookup failed');
        }

        const metadataOrderId = session && session.metadata ? String(session.metadata.order_id || '') : '';
        if (metadataOrderId && metadataOrderId !== orderId) {
            return res.status(400).json({ error: 'Order mismatch.' });
        }

        if (session.payment_status === 'paid') {
            const updatedOrder = await updateOrderStatus(orderId, 'Pago');
            return res.status(200).json(updatedOrder || { id: orderId, status: 'Pago' });
        }

        const order = await fetchOrder(orderId);
        return res.status(200).json(order || { id: orderId, status: 'Pendente' });
    } catch (error) {
        console.error('Confirm Order Error:', error);
        res.status(500).json({ error: 'Internal Server Error', detail: error.message });
    }
}
