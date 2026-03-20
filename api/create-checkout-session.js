const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

function formEncode(payload) {
    const params = new URLSearchParams();
    Object.keys(payload).forEach((key) => {
        if (payload[key] !== undefined && payload[key] !== null) {
            params.append(key, String(payload[key]));
        }
    });
    return params;
}

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

async function insertPendingOrder(order) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify(order)
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data && data.message ? data.message : 'Failed to create pending order');
    }

    return data[0];
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'Supabase server environment is not configured.' });
    }

    try {
        const body = req.body || {};
        const settings = await readAdminSettings();
        const stripeSecretKey = process.env.STRIPE_SECRET_KEY || settings.stripe_secret_key || settings.stripeSecKey || '';
        const stripePublicKey = process.env.STRIPE_PUBLIC_KEY || settings.stripe_public_key || settings.stripePubKey || '';

        if (!stripeSecretKey || !stripePublicKey) {
            return res.status(500).json({ error: 'Stripe is not configured on the server.' });
        }

        const amount = Number(body.amount || 0);
        const order = Object.assign({}, body.order || {}, { status: 'Pendente' });
        const pendingOrder = await insertPendingOrder(order);

        const successBase = String(body.successUrl || '').trim();
        const cancelUrl = String(body.cancelUrl || '').trim();
        const successUrl = `${successBase}?order_id=${encodeURIComponent(pendingOrder.id)}&session_id={CHECKOUT_SESSION_ID}`;

        const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${stripeSecretKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formEncode({
                'payment_method_types[]': 'card',
                'line_items[0][price_data][currency]': 'gbp',
                'line_items[0][price_data][product_data][name]': String(body.productName || order.product_name || 'Order'),
                'line_items[0][price_data][unit_amount]': Math.round(amount * 100),
                'line_items[0][quantity]': '1',
                'mode': 'payment',
                'success_url': successUrl,
                'cancel_url': cancelUrl,
                'metadata[order_id]': String(pendingOrder.id)
            })
        });

        const session = await stripeResponse.json();
        if (!stripeResponse.ok || !session.url) {
            throw new Error(session && session.error && session.error.message ? session.error.message : 'Stripe checkout session failed');
        }

        res.status(200).json({
            url: session.url,
            id: session.id,
            publishableKey: stripePublicKey,
            order: pendingOrder
        });
    } catch (error) {
        console.error('Stripe API Error:', error);
        res.status(500).json({ error: 'Internal Server Error', detail: error.message });
    }
}
