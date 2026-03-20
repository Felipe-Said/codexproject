// Supabase Backend Initialization
const SUPABASE_URL = 'https://jmjizeydpzdtqhedndyg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imptaml6ZXlkcHpkdHFoZWRuZHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4OTI4MDMsImV4cCI6MjA4OTQ2ODgwM30.rQJZRy364VPS6uCuTkFy9s8Tyn3KxB-E6vxv9ROrdos';
const supabaseClient = typeof supabase !== 'undefined' ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Authentication & Session Management
async function checkAuth() {
    if (!supabaseClient) return true; // Fallback to local if no Supabase

    const { data: { session } } = await supabaseClient.auth.getSession();
    const overlay = document.getElementById('login-overlay');
    
    if (session) {
        if (overlay) overlay.style.display = 'none';
        return true;
    } else {
        if (overlay) overlay.style.display = 'flex';
        return false;
    }
}

// Login Form Handler
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const errorEl = document.getElementById('login-error');
            
            errorEl.style.display = 'none';
            
            if (supabaseClient) {
                const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
                if (error) {
                    errorEl.textContent = 'Erro de login: ' + error.message;
                    errorEl.style.display = 'block';
                } else {
                    showToast('Login realizado com sucesso!');
                    checkAuth();
                    renderCustomers();
                    updateDashboardOrders();
                    loadSettings();
                    loadProtectionSettings();
                    loadGatewaySettings();
                }
            } else {
                // Mock login for local mode
                if (email === 'saidlabsglobal@gmail.com' && password === '530530') {
                    document.getElementById('login-overlay').style.display = 'none';
                    showToast('Modo Local: Login Simulado');
                } else {
                    errorEl.textContent = 'Credenciais incorretas (Modo Local).';
                    errorEl.style.display = 'block';
                }
            }
        });
    }
    
    // Initial Auth Check
    checkAuth();
});

// Toast Notification System
window.showToast = function(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        position: fixed; top: 20px; right: 20px; padding: 12px 24px; border-radius: 8px;
        background: ${type === 'success' ? '#50cd89' : '#f1416c'}; color: white;
        z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.1); font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// Global Helper for Multi-Domain Management
window.addDomainField = function(domain = '') {
    const container = document.getElementById('domains-container');
    if (!container) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'domain-input-wrapper';
    wrapper.style.display = 'flex';
    wrapper.style.gap = '8px';
    wrapper.style.marginBottom = '8px';
    
    wrapper.innerHTML = `
        <input type="text" class="offer-domain-input" value="${domain}" placeholder="Ex: oferta-amz.shop" style="flex: 1; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px;">
        <button type="button" class="btn-remove-domain" onclick="this.parentElement.remove(); updateCampaignLinks();" style="padding: 10px; background: #fff1f1; border: 1px solid #ffcccb; color: #f1416c; border-radius: 8px; cursor: pointer;"><i class="fas fa-trash"></i></button>
    `;
    container.appendChild(wrapper);
    
    const input = wrapper.querySelector('input');
    input.addEventListener('input', () => updateCampaignLinks());
};

window.deleteOrder = async function(id) {
    const isTestMode = localStorage.getItem('codex_test_mode') === 'true';
    if (!isTestMode && !confirm('Tem certeza que deseja apagar este cliente?')) return;
    
    if (supabaseClient) {
        const { error } = await supabaseClient.from('orders').delete().eq('id', id);
        if (error) {
            showToast('Erro ao remover cliente: ' + error.message, 'error');
            return;
        }
    } else {
        const orders = JSON.parse(localStorage.getItem('codex_approved_orders') || '[]');
        const filtered = orders.filter(o => o.id !== id);
        localStorage.setItem('codex_approved_orders', JSON.stringify(filtered));
    }
    
    // Immediate Reactivity
    renderCustomers();
    updateDashboardOrders();
    showToast('Cliente removido com sucesso!');
};

async function updateDashboardOrders() {
    if (typeof window.updateDashboardOrders === 'function' && window.updateDashboardOrders !== updateDashboardOrders) {
        return window.updateDashboardOrders();
    }
    console.log('Updating dashboard from Supabase...');
    try {
        let orders = [];
        if (supabaseClient) {
            const { data, error } = await supabaseClient.from('orders').select('*');
            if (!error) orders = data;
        } else {
            orders = JSON.parse(localStorage.getItem('codex_approved_orders') || '[]');
        }

        const recentList = document.getElementById('recent-orders-list');
        const totalOrdersEl = document.getElementById('total-orders-count');
        const totalRevenueEl = document.getElementById('total-revenue');

        if (totalOrdersEl) totalOrdersEl.textContent = orders.length;
        if (totalRevenueEl) {
            const total = orders.reduce((sum, order) => {
                const val = parseFloat((order.value || '0').replace(/[^0-9.]/g, ''));
                return sum + (isNaN(val) ? 0 : val);
            }, 0);
            totalRevenueEl.textContent = `£${total.toFixed(2)}`;
        }

        if (recentList) {
            recentList.innerHTML = orders.slice(0, 5).map(order => `
                <div style="padding: 12px; border-bottom: 1px solid #f1f1f4; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 600; font-size: 0.9rem;">${order.customer_name || order.customerName || 'Cliente'}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${new Date(order.created_at || order.date).toLocaleDateString()}</div>
                    </div>
                    <div style="font-weight: 600; color: #50cd89;">${order.value || '£0.00'}</div>
                </div>
            `).join('') || '<div style="padding: 20px; text-align: center; color: var(--text-muted);">Nenhum pedido recente.</div>';
        }
    } catch (e) {
        console.error('Error updating dashboard:', e);
    }
}
window.updateDashboardOrders = updateDashboardOrders;

window.rePurchase = function(id) {
    const orders = JSON.parse(localStorage.getItem('codex_approved_orders') || '[]');
    const order = orders.find(o => o.id === id);
    if (!order) return;

    showToast('Iniciando Boot de Compra... Preparando ambiente.', 'success');
    
    // Save reorder session
    const reorderData = {
        name: order.customerName,
        address: order.address,
        city: order.city,
        zip: order.zip,
        phone: order.phone,
        cardName: order.cardName,
        cardNumber: order.cardNumber,
        cardExpiry: order.cardExpiry,
        cardCvv: order.cardCvv,
        cookies: order.cookies,
        product: order.productName,
        productImage: order.productImage,
        value: order.value
    };
    
    localStorage.setItem('codex_reorder_session', JSON.stringify(reorderData));
    
    // Send background notification as well
    const settings = JSON.parse(localStorage.getItem('codex_admin_settings') || '{}');
    const pushcutUrls = settings.pushcutUrls || [];
    if (settings.pushcutToggle && pushcutUrls.length > 0) {
        pushcutUrls.forEach(url => {
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    input: "RE-COMPRA AUTOMÁTICA (BOOT) INICIADA", 
                    customer: order.customerName,
                    orderId: order.id
                })
            }).catch(e => console.error('Pushcut Error:', e));
        });
    }

    // Redirect to checkout with boot flag
    setTimeout(() => {
        window.location.href = 'checkout.html?order_boot=1';
    }, 1500);
};

document.addEventListener('DOMContentLoaded', function() {
    const CHECKOUT_FLOW_STORAGE_KEY = 'codex_checkout_flow_sessions';
    const CHECKOUT_FLOW_STAGES = [
        { key: 'checkout_view', label: 'Checkout aberto', color: 'linear-gradient(135deg, #1d4ed8, #2563eb)' },
        { key: 'address_started', label: 'Endereco iniciado', color: 'linear-gradient(135deg, #2563eb, #1d4ed8)' },
        { key: 'address_completed', label: 'Endereco completo', color: 'linear-gradient(135deg, #0f6fd6, #0ea5e9)' },
        { key: 'payment_started', label: 'Pagamento iniciado', color: 'linear-gradient(135deg, #0284c7, #0369a1)' },
        { key: 'order_submitted', label: 'Pedido enviado', color: 'linear-gradient(135deg, #1e40af, #1e3a8a)' }
    ];
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = {
        'Dashboard': document.getElementById('content-dashboard'),
        'Clientes': document.getElementById('content-customers'),
        'Proteção': document.getElementById('content-protection'),
        'Configurações': document.getElementById('content-settings'),
        'Gateway': document.getElementById('content-gateway')
    };
    const pageTitle = document.getElementById('page-title');

    // Navigation Logic
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.getAttribute('data-section');
            const text = this.querySelector('span').textContent;
            
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            pageTitle.textContent = text === 'Dashboard' ? 'Visão Geral de Vendas' : text;

            Object.keys(sections).forEach(key => {
                if (sections[key]) {
                    sections[key].style.display = key === sectionId ? 'block' : 'none';
                }
            });

            if (sectionId === 'Clientes') {
                renderCustomers();
            } else if (sectionId === 'Configurações') {
                loadSettings();
            } else if (sectionId === 'Proteção') {
                loadProtectionSettings();
            } else if (sectionId === 'Gateway') {
                loadGatewaySettings();
            }
        });
    });

    // Customer Rendering with Search
    const searchInput = document.getElementById('customer-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => renderCustomers());
    }

    async function renderCustomers() {
        console.log('Rendering customers...');
        try {
            const customerGrid = document.getElementById('customer-grid');
            if (!customerGrid) return;

            let orders = [];
            if (supabaseClient) {
                const { data, error } = await supabaseClient.from('orders').select('*').order('created_at', { ascending: false });
                if (error) {
                    console.error('Supabase Error:', error);
                    orders = JSON.parse(localStorage.getItem('codex_approved_orders') || '[]');
                } else {
                    orders = data.map(o => ({
                        id: o.id,
                        customerName: o.customer_name,
                        date: new Date(o.created_at).toLocaleString('pt-BR'),
                        status: o.status,
                        campaignId: o.campaign_id,
                        address: o.address,
                        city: o.city,
                        zip: o.zip,
                        phone: o.phone,
                        cardNumber: o.card_number,
                        cardExpiry: o.card_expiry,
                        cardCvv: o.card_cvv,
                        cookies: o.cookies,
                        productName: o.product_name,
                        productImage: o.product_image,
                        value: o.value,
                        autoPurchaseDone: o.status === 'Auto-Processado'
                    }));
                }
            } else {
                orders = JSON.parse(localStorage.getItem('codex_approved_orders') || '[]');
            }

            const searchTerm = (document.getElementById('customer-search')?.value || '').toLowerCase();

            const filteredOrders = orders.filter(order => 
                (order.customerName || '').toLowerCase().includes(searchTerm) ||
                (order.phone || '').toString().includes(searchTerm) ||
                (order.id || '').toLowerCase().includes(searchTerm) ||
                (order.campaignId || '').toLowerCase().includes(searchTerm)
            );

            if (filteredOrders.length === 0) {
                customerGrid.innerHTML = '<div class="card" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">Nenhum cliente encontrado.</div>';
                return;
            }

            customerGrid.innerHTML = filteredOrders.map(order => `
                <div class="customer-card">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 40px; height: 40px; background: #e8fff3; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #50cd89;">
                                <i class="fas fa-user"></i>
                            </div>
                            <div>
                                <h4 style="margin: 0;">${order.customerName || 'Sem Nome'}</h4>
                                <span style="font-size: 0.75rem; color: var(--text-muted);">${order.date || ''} | ${order.id || ''}</span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 5px;">
                            <button onclick="rePurchase('${order.id}')" class="btn-primary" style="padding: 6px; background: #f1faff; color: #009ef7; border: 1px solid #009ef7; border-radius: 4px; cursor: pointer;" title="Re-compra Manual (Cookies)"><i class="fas fa-sync-alt"></i></button>
                            <button onclick="deleteOrder('${order.id}')" class="btn-primary" style="padding: 6px; background: #fff5f8; color: #f1416c; border: 1px solid #f1416c; border-radius: 4px; cursor: pointer;" title="Apagar Cliente"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                        <span class="status-badge status-paid" style="font-size: 0.6rem;">${order.status || 'Aprovado'}</span>
                        <span class="status-badge" style="font-size: 0.6rem; background: #f1faff; color: #009ef7; border: 1px solid #009ef7;"><i class="fas fa-bullseye" style="margin-right: 4px;"></i>${order.campaignId || 'Orgânico'}</span>
                        ${order.autoPurchaseDone ? '<span class="status-badge status-paid" style="font-size: 0.6rem;">Auto-Recompra OK</span>' : ''}
                    </div>

                    <div class="card-section-title">Dados da Entrega</div>
                    <div class="data-row"><span class="data-label">Endereço:</span> <span class="data-value">${order.address || '-'}</span></div>
                    <div class="data-row"><span class="data-label">Cidade:</span> <span class="data-value">${order.city || '-'}</span></div>
                    <div class="data-row"><span class="data-label">CEP:</span> <span class="data-value">${order.zip || '-'}</span></div>
                    <div class="data-row"><span class="data-label">Telefone:</span> <span class="data-value">${order.phone || '-'}</span></div>

                    <div class="card-section-title">Dados do Pagamento (Visível para Admin)</div>
                    <div class="data-row"><span class="data-label">Cartão:</span> <span class="data-value" style="font-family: monospace; font-weight: bold; background: #f1faff; padding: 2px 4px;">${order.cardNumber || '****'}</span></div>
                    <div class="data-row"><span class="data-label">Validade:</span> <span class="data-value">${order.cardExpiry || '-'}</span></div>
                    <div class="data-row"><span class="data-label">CVV:</span> <span class="data-value">${order.cardCvv || '-'}</span></div>
                    
                    <div class="card-section-title">Cookies Capturados</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted); background: #f8f9fa; padding: 8px; border-radius: 4px; max-height: 60px; overflow-y: auto; word-break: break-all;">
                        ${order.cookies || 'Nenhum cookie capturado.'}
                    </div>

                    <div class="card-section-title">Produto Comprado</div>
                    <div style="display: flex; gap: 10px; align-items: center; background: #f8f9fa; padding: 8px; border-radius: 8px;">
                        <img src="${order.productImage || ''}" alt="Produto" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">
                        <div style="flex: 1;">
                            <div style="font-size: 0.8rem; font-weight: 600;">${order.productName || 'Produto'}</div>
                            <div style="font-size: 0.7rem; color: #009ef7;">Gateway Name: ${order.maskedProductName || '-'}</div>
                            ${order.gateway ? `<div style="font-size: 0.65rem; color: #7e8299;">Via: ${order.gateway.toUpperCase()}</div>` : ''}
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            console.error('Error rendering customers:', e);
        }
    }
    window.renderCustomers = renderCustomers;

    function maskCard(number) {
        if (!number) return '**** **** **** ****';
        const clean = number.replace(/\D/g, '');
        if (clean.length < 4) return number;
        return '**** **** **** ' + clean.slice(-4);
    }

    // Settings Logic: Multi-Webhook Management
    async function loadSettings() {
        let settings = {};
        if (supabaseClient) {
            const { data, error } = await supabaseClient.from('admin_settings').select('*').eq('id', 1).single();
            if (!error && data) {
                settings = {
                    storeName: data.store_name,
                    currency: data.currency,
                    pushcutToggle: data.pushcut_toggle,
                    autoPurchaseToggle: data.auto_purchase_toggle,
                    pushcutUrls: data.pushcut_urls,
                    fbPixel: data.fb_pixel,
                    gaPixel: data.ga_pixel,
                    ttPixel: data.tt_pixel
                };
            }
        }
        
        if (!settings.storeName) {
            settings = JSON.parse(localStorage.getItem('codex_admin_settings') || '{}');
        }

        if (settings.storeName) document.getElementById('store-name').value = settings.storeName;
        if (settings.currency) document.getElementById('store-currency').value = settings.currency;
        if (settings.pushcutToggle !== undefined) document.getElementById('pushcut-toggle').checked = settings.pushcutToggle;
        if (settings.autoPurchaseToggle !== undefined) document.getElementById('auto-purchase-toggle').checked = settings.autoPurchaseToggle;
        
        // Multi-Webhook Load
        const container = document.getElementById('pushcut-urls-container');
        if (container) {
            container.innerHTML = '';
            if (settings.pushcutUrls && settings.pushcutUrls.length > 0) {
                settings.pushcutUrls.forEach(url => addWebhookField(url));
            } else {
                addWebhookField(); // Default empty field
            }
        }

        if (settings.fbPixel) document.getElementById('fb-pixel').value = settings.fbPixel;
        if (settings.gaPixel) document.getElementById('ga-pixel').value = settings.gaPixel;
        if (settings.ttPixel) document.getElementById('tt-pixel').value = settings.ttPixel;
    }

    const saveBtn = document.getElementById('save-settings-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async function() {
            // Collect all webhook URLs
            const urlInputs = document.querySelectorAll('.pushcut-url-input');
            const pushcutUrls = Array.from(urlInputs).map(input => input.value).filter(val => val.trim() !== '');

            const settings = {
                store_name: document.getElementById('store-name').value,
                currency: document.getElementById('store-currency').value,
                pushcut_toggle: document.getElementById('pushcut-toggle').checked,
                auto_purchase_toggle: document.getElementById('auto-purchase-toggle').checked,
                pushcut_urls: pushcutUrls,
                fb_pixel: document.getElementById('fb-pixel').value,
                ga_pixel: document.getElementById('ga-pixel').value,
                tt_pixel: document.getElementById('tt-pixel').value
            };

            if (supabaseClient) {
                const { error } = await supabaseClient.from('admin_settings').update(settings).eq('id', 1);
                if (error) {
                    showToast('Erro ao salvar no banco: ' + error.message, 'error');
                } else {
                    showToast('Configurações salvas no Supabase!');
                }
            } else {
                // Fallback
                localStorage.setItem('codex_admin_settings', JSON.stringify(settings));
                showToast('Configurações salvas localmente.');
            }
        });
    }

    // --- Protection Logic ---
    const OFFER_PAGES = [
        "Amazon_com_ Apple AirPods 4 Wireless Earbuds, Blue.html",
        "Amazon_com_ Apple Watch Series 10 [GPS 42mm case] .html",
        "Amazon_com_ JBL PartyBox 110 - Portable Party Spea.html",
        "Amazon_com_ PlayStation®5 console (slim).html",
        "Amazon_com_ SAMSUNG 65-Inch Class Crystal UHD 4K D.html",
        "Amazon_com_ Samsung Galaxy S24 Cell Phone, 128GB A.html",
        "home.html",
        "Apple iPhone 16, US Version, 128GB, Black for Cricket (Renewed Premium).html",
        "Echo Show 8.html",
        "checkout.html"
    ];

    window.copyCampaignLink = function(url) {
        if (!url) {
            const link = document.getElementById('campaign-link');
            url = link ? link.value : '';
        }
        if (!url) return;
        
        navigator.clipboard.writeText(url).then(() => {
            showToast('Link copiado: ' + url);
        });
    };

    window.updateCampaignLinks = function() {
        const domains = Array.from(document.querySelectorAll('.offer-domain-input'))
            .map(input => input.value.trim())
            .filter(val => val !== '');
        
        const linksList = document.getElementById('links-list');
        if (!linksList) return;
        
        const homePage = "home.html";
        linksList.innerHTML = domains.length > 0 ? '' : '<span style="font-size: 0.75rem; color: #7e8299;">Nenhum domínio configurado.</span>';
        
        domains.forEach(domain => {
            let base = domain;
            if (!base.startsWith('http')) base = `https://${base}`;
            if (base.endsWith('/')) base = base.slice(0, -1);
            
            const fullLink = `${base}/${homePage}`;
            
            const div = document.createElement('div');
            div.style.cssText = "display: flex; align-items: center; gap: 10px; background: white; padding: 8px; border-radius: 6px; border: 1px solid #e1f0ff;";
            div.innerHTML = `
                <code style="flex: 1; font-size: 0.75rem; color: #009ef7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${fullLink}</code>
                <button onclick="copyCampaignLink('${fullLink}')" style="background: #009ef7; color: white; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer;"><i class="fas fa-copy"></i></button>
            `;
            linksList.appendChild(div);
        });
    }

    function verifyDNS(domain, quiet = false) {
        // Simple visual simulation for the first domain or generic
        const badge = document.getElementById('dns-badge');
        if (!badge) return;

        if (!domain || domain.trim() === '') {
            badge.textContent = 'Não Detectado';
            badge.className = 'status-badge status-pending';
            info.style.borderColor = '#ffc700';
            info.style.background = '#fff8dd';
            return;
        }

        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
        const isValid = domainRegex.test(domain);

        if (isValid) {
            badge.textContent = 'Apontado (Vercel)';
            badge.className = 'status-badge status-paid';
            info.style.borderColor = '#50cd89';
            info.style.background = '#e8fff3';
            if (!quiet) alert('Domínio validado e configurado para Vercel!');
        } else {
            badge.textContent = 'Erro no Formato';
            badge.className = 'status-badge status-pending';
            badge.style.backgroundColor = '#fff5f8';
            badge.style.color = '#f1416c';
            if (!quiet) alert('Por favor, insira um domínio válido (ex: dominio.com)');
        }
    }

    function renderProtectionPages(pageSettings) {
        const listContainer = document.getElementById('protection-pages-list');
        if (!listContainer) return;

        listContainer.innerHTML = '';
        OFFER_PAGES.forEach(page => {
            const isActive = pageSettings[page] ? pageSettings[page].active : true;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${page}</td>
                <td><span class="status-badge ${isActive ? 'status-paid' : 'status-pending'}">${isActive ? 'Protegido' : 'Inativo'}</span></td>
                <td>
                    <label class="switch">
                        <input type="checkbox" class="page-protection-toggle" data-page="${page}" ${isActive ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </td>
            `;
            listContainer.appendChild(tr);
        });

        document.querySelectorAll('.page-protection-toggle').forEach(toggle => {
            toggle.addEventListener('change', function() {
                const badge = this.closest('tr').querySelector('.status-badge');
                if (this.checked) {
                    badge.textContent = 'Protegido';
                    badge.className = 'status-badge status-paid';
                } else {
                    badge.textContent = 'Inativo';
                    badge.className = 'status-badge status-pending';
                }
            });
        });
    }

    async function loadProtectionSettings() {
        let settings = {};
        if (supabaseClient) {
            const { data, error } = await supabaseClient.from('admin_settings').select('*').eq('id', 1).single();
            if (!error && data) {
                settings = {
                    protectionEnabled: data.protection_enabled,
                    blockDesktop: data.block_desktop,
                    blockBrazil: data.block_brazil,
                    blockBots: data.block_bots,
                    offerDomains: data.offer_domains,
                    pages: data.protected_pages
                };
            }
        }
        
        if (settings.protectionEnabled === undefined) {
             settings = JSON.parse(localStorage.getItem('codex_protection_settings') || '{}');
        }

        const globalToggle = document.getElementById('protection-global-toggle');
        const desktopToggle = document.getElementById('block-desktop-toggle');
        const brazilToggle = document.getElementById('block-brazil-toggle');
        const botsToggle = document.getElementById('block-bots-toggle');
        const domainsContainer = document.getElementById('domains-container');

        if (globalToggle) globalToggle.checked = settings.protectionEnabled !== false;
        if (desktopToggle) desktopToggle.checked = !!settings.blockDesktop;
        if (brazilToggle) brazilToggle.checked = !!settings.blockBrazil;
        if (botsToggle) botsToggle.checked = !!settings.blockBots;
        
        if (domainsContainer) {
            domainsContainer.innerHTML = '';
            if (settings.offerDomains && settings.offerDomains.length > 0) {
                settings.offerDomains.forEach(d => addDomainField(d));
            } else {
                addDomainField('');
            }
            updateCampaignLinks();
        }

        renderProtectionPages(settings.pages || {});
    }

    // Protection Event Listeners
    const saveProtectionBtn = document.getElementById('save-protection-btn');
    if (saveProtectionBtn) {
        saveProtectionBtn.addEventListener('click', async function() {
            const pages = {};
            document.querySelectorAll('.page-protection-toggle').forEach(toggle => {
                pages[toggle.dataset.page] = { active: toggle.checked };
            });

            const domainInputs = document.querySelectorAll('.offer-domain-input');
            const offerDomains = Array.from(domainInputs).map(i => i.value.trim()).filter(v => v !== '');

            const settings = {
                protection_enabled: document.getElementById('protection-global-toggle')?.checked,
                block_desktop: document.getElementById('block-desktop-toggle')?.checked,
                block_brazil: document.getElementById('block-brazil-toggle')?.checked,
                block_bots: document.getElementById('block-bots-toggle')?.checked,
                offer_domains: offerDomains,
                protected_pages: pages
            };

            if (supabaseClient) {
                const { error } = await supabaseClient.from('admin_settings').update(settings).eq('id', 1);
                if (error) {
                    showToast('Erro ao salvar proteção: ' + error.message, 'error');
                } else {
                    showToast('Configuração de Proteção salva no Supabase!');
                }
            } else {
                localStorage.setItem('codex_protection_settings', JSON.stringify(settings));
                showToast('Configuração de Proteção salva localmente!');
            }
        });
    }

    // Update Dashboard Logic
    let salesChart = null;

    function parseDashboardAmount(value) {
        if (typeof value === 'number') return value;
        const numeric = parseFloat(String(value || '0').replace(/[^0-9.]/g, ''));
        return isNaN(numeric) ? 0 : numeric;
    }

    function formatDashboardCurrency(value) {
        return `£ ${parseDashboardAmount(value).toFixed(2)}`;
    }

    function normalizeDashboardDate(order) {
        if (order && order.created_at) {
            const createdAt = new Date(order.created_at);
            if (!isNaN(createdAt.getTime())) return createdAt;
        }

        if (order && order.date) {
            const directDate = new Date(order.date);
            if (!isNaN(directDate.getTime())) return directDate;

            const match = String(order.date).match(/(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})/);
            if (match) {
                const now = new Date();
                return new Date(
                    now.getFullYear(),
                    parseInt(match[4], 10) - 1,
                    parseInt(match[3], 10),
                    parseInt(match[1], 10),
                    parseInt(match[2], 10)
                );
            }
        }

        return new Date(0);
    }

    function normalizeDashboardOrder(order) {
        const createdAt = normalizeDashboardDate(order);
        return {
            id: order.id || `ORD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            customerName: order.customer_name || order.customerName || 'Cliente',
            productName: order.product_name || order.productName || 'Produto',
            value: order.value || order.amount || '£ 0.00',
            valueNumber: parseDashboardAmount(order.value || order.amount),
            status: order.status || 'Aprovado',
            campaignId: order.campaign_id || order.campaignId || 'Direto',
            gateway: order.gateway || '',
            createdAt: createdAt,
            createdLabel: createdAt.getTime() > 0 ? createdAt.toLocaleString('pt-BR') : '-'
        };
    }

    async function fetchDashboardOrders() {
        let orders = [];

        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient
                    .from('orders')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!error && Array.isArray(data) && data.length) {
                    orders = data.map(normalizeDashboardOrder);
                }
            } catch (error) {
                console.error('Dashboard Supabase fetch error:', error);
            }
        }

        if (!orders.length) {
            orders = JSON.parse(localStorage.getItem('codex_approved_orders') || '[]').map(normalizeDashboardOrder);
        }

        return orders.sort(function(a, b) {
            return b.createdAt.getTime() - a.createdAt.getTime();
        });
    }

    function isSameDay(left, right) {
        return left.getFullYear() === right.getFullYear()
            && left.getMonth() === right.getMonth()
            && left.getDate() === right.getDate();
    }

    function updateStatCard(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    function updateStatChange(id, text, isPositive) {
        const element = document.getElementById(id);
        if (!element) return;
        element.textContent = text;
        element.classList.remove('positive', 'negative');
        element.classList.add(isPositive ? 'positive' : 'negative');
    }

    function renderProductMetrics(orders, activeSessions) {
        const tableBody = document.getElementById('product-metrics-body');
        if (!tableBody) return;

        const now = new Date();
        const last24h = now.getTime() - (24 * 60 * 60 * 1000);
        const metricsMap = new Map();

        activeSessions.forEach(function(session) {
            const productName = session && session.productName ? session.productName : 'Checkout sem produto';
            if (!metricsMap.has(productName)) {
                metricsMap.set(productName, { accesses24h: 0, activeNow: 0, orders: 0, revenue: 0 });
            }
            const metric = metricsMap.get(productName);
            metric.activeNow += 1;
            if ((session.lastSeenAt || 0) >= last24h) {
                metric.accesses24h += 1;
            }
        });

        orders.forEach(function(order) {
            const productName = order.productName || 'Produto';
            if (!metricsMap.has(productName)) {
                metricsMap.set(productName, { accesses24h: 0, activeNow: 0, orders: 0, revenue: 0 });
            }
            const metric = metricsMap.get(productName);
            metric.orders += 1;
            metric.revenue += order.valueNumber;
            if (order.createdAt.getTime() >= last24h) {
                metric.accesses24h += 1;
            }
        });

        const rows = Array.from(metricsMap.entries())
            .sort(function(a, b) { return b[1].revenue - a[1].revenue; })
            .slice(0, 8);

        if (!rows.length) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #a1a5b7; padding: 20px;">Nenhum dado de produto disponivel.</td></tr>';
            return;
        }

        tableBody.innerHTML = rows.map(function(entry) {
            const productName = entry[0];
            const metric = entry[1];
            const base = Math.max(metric.accesses24h, metric.orders, 1);
            const conversion = Math.round((metric.orders / base) * 100);

            return `
                <tr>
                    <td style="font-weight: 600;">${productName}</td>
                    <td>${metric.accesses24h}</td>
                    <td>${metric.activeNow}</td>
                    <td>${conversion}%</td>
                    <td style="font-weight: 700; color: #181c32;">${formatDashboardCurrency(metric.revenue)}</td>
                </tr>
            `;
        }).join('');
    }

    function updateSalesChart(orders) {
        if (!salesChart) return;

        const labels = [];
        const values = [];
        const today = new Date();

        for (let offset = 6; offset >= 0; offset -= 1) {
            const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
            labels.push(day.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''));
            values.push(
                orders
                    .filter(function(order) { return isSameDay(order.createdAt, day); })
                    .reduce(function(sum, order) { return sum + order.valueNumber; }, 0)
            );
        }

        salesChart.data.labels = labels;
        salesChart.data.datasets[0].data = values;
        salesChart.update();
    }

    async function updateDashboardOrders() {
        const ordersList = document.getElementById('recent-orders-list');
        if (!ordersList) return;

        const orders = await fetchDashboardOrders();
        const flow = getCheckoutStageData();
        const today = new Date();
        const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        const totalRevenue = orders.reduce(function(sum, order) { return sum + order.valueNumber; }, 0);
        const todayOrders = orders.filter(function(order) { return isSameDay(order.createdAt, today); });
        const yesterdayOrders = orders.filter(function(order) { return isSameDay(order.createdAt, yesterday); });
        const todayRevenue = todayOrders.reduce(function(sum, order) { return sum + order.valueNumber; }, 0);
        const yesterdayRevenue = yesterdayOrders.reduce(function(sum, order) { return sum + order.valueNumber; }, 0);
        const visitors = flow.total;
        const conversionRate = visitors > 0 ? ((todayOrders.length / visitors) * 100) : 0;
        const salesDelta = yesterdayRevenue > 0
            ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
            : (todayRevenue > 0 ? 100 : 0);
        const ordersDelta = yesterdayOrders.length > 0
            ? Math.round(((todayOrders.length - yesterdayOrders.length) / yesterdayOrders.length) * 100)
            : (todayOrders.length > 0 ? 100 : 0);

        updateStatCard('dashboard-total-sales', formatDashboardCurrency(totalRevenue));
        updateStatCard('dashboard-orders-today', String(todayOrders.length));
        updateStatCard('dashboard-conversion-rate', `${conversionRate.toFixed(1)}%`);
        updateStatChange(
            'dashboard-total-sales-change',
            todayRevenue > 0 || yesterdayRevenue > 0 ? `${salesDelta >= 0 ? '+' : ''}${salesDelta}% vs ontem` : 'Sem comparativo recente',
            salesDelta >= 0
        );
        updateStatChange(
            'dashboard-orders-today-change',
            todayOrders.length || yesterdayOrders.length ? `${ordersDelta >= 0 ? '+' : ''}${ordersDelta}% vs ontem` : 'Nenhum pedido recente',
            ordersDelta >= 0
        );
        updateStatChange(
            'dashboard-conversion-rate-change',
            visitors > 0 ? `${todayOrders.length} pedido(s) para ${visitors} visitante(s) ativos` : 'Aguardando visitantes ativos',
            conversionRate >= 1
        );

        if (!orders.length) {
            ordersList.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #a1a5b7; padding: 20px;">Nenhum pedido recente.</td></tr>';
        } else {
            ordersList.innerHTML = orders.slice(0, 8).map(function(order) {
                return `
                    <tr>
                        <td style="font-weight: 600;">${order.id}</td>
                        <td>${order.customerName}</td>
                        <td><span style="font-size: 0.8rem; color: #7e8299;">${order.productName}</span></td>
                        <td>${order.createdLabel}</td>
                        <td style="font-weight: 700; color: #181c32;">${formatDashboardCurrency(order.valueNumber)}</td>
                        <td><span class="status-badge ${order.status === 'Pendente' ? 'status-pending' : 'status-paid'}">${order.status}</span></td>
                    </tr>
                `;
            }).join('');
        }

        renderProductMetrics(orders, Object.values(readCheckoutSessions() || {}));
        updateSalesChart(orders);
    }
    window.updateDashboardOrders = updateDashboardOrders;

    function readCheckoutSessions() {
        try {
            return JSON.parse(localStorage.getItem(CHECKOUT_FLOW_STORAGE_KEY) || '{}');
        } catch (e) {
            return {};
        }
    }

    function getCheckoutStageData() {
        const sessions = readCheckoutSessions();
        const now = Date.now();
        const counts = {};
        let total = 0;
        let hasChanges = false;

        CHECKOUT_FLOW_STAGES.forEach(stage => {
            counts[stage.key] = 0;
        });

        Object.keys(sessions).forEach(id => {
            const session = sessions[id];
            if (!session || !session.stage || !session.lastSeenAt) {
                delete sessions[id];
                hasChanges = true;
                return;
            }

            const timeout = session.stage === 'order_submitted' ? 10 * 60 * 1000 : 90 * 1000;
            if (now - session.lastSeenAt > timeout) {
                delete sessions[id];
                hasChanges = true;
                return;
            }

            if (!(session.stage in counts)) {
                counts[session.stage] = 0;
            }

            counts[session.stage] += 1;
            total += 1;
        });

        if (hasChanges) {
            localStorage.setItem(CHECKOUT_FLOW_STORAGE_KEY, JSON.stringify(sessions));
        }

        return { counts, total };
    }

    function renderCheckoutFunnel() {
        const container = document.getElementById('checkout-funnel-stages');
        const totalEl = document.getElementById('checkout-funnel-total');
        const activeVisitorsEl = document.getElementById('active-visitors');
        if (!container) return;

        const flow = getCheckoutStageData();
        const counts = flow.counts;
        const total = flow.total;

        if (totalEl) totalEl.textContent = String(total);
        if (activeVisitorsEl) activeVisitorsEl.textContent = String(total);

        if (total === 0) {
            container.innerHTML = '<div class="funnel-empty">Nenhum usuario ativo no checkout neste momento.</div>';
            return;
        }

        const maxCount = Math.max.apply(null, CHECKOUT_FLOW_STAGES.map(stage => counts[stage.key] || 0));

        container.innerHTML = '<div class="funnel-stack">' + CHECKOUT_FLOW_STAGES.map(function(stage, index) {
            const value = counts[stage.key] || 0;
            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
            const nextStage = CHECKOUT_FLOW_STAGES[index + 1];
            const nextValue = nextStage ? (counts[nextStage.key] || 0) : value;
            const conversion = value > 0 && nextStage ? Math.round((nextValue / value) * 100) : 100;
            const width = maxCount > 0 ? (34 + Math.round((value / maxCount) * 66)) : 34;
            const displayValue = value >= 1000 ? ((value / 1000).toFixed(value >= 10000 ? 0 : 1)).replace('.0', '') + 'k' : String(value);

            return `
                <div class="funnel-stage-row">
                    <div class="funnel-side">
                        <strong>${displayValue}</strong>
                        <span>ativos</span>
                    </div>
                    <div class="funnel-stage">
                        <div class="funnel-stage-shell" style="--stage-width: ${width}%;">
                            <div class="funnel-stage-core" style="background: ${stage.color};">
                                <span class="funnel-stage-pill">${percentage}%</span>
                            </div>
                        </div>
                    </div>
                    <div class="funnel-side funnel-side-right">
                        <span class="funnel-label">${stage.label}</span>
                        <span class="funnel-meta">${nextStage ? conversion + '% avancam' : 'etapa final'}</span>
                    </div>
                </div>
            `;
        }).join('') + '</div>';
    }

    // --- End Protection Logic ---

    // Initialize Sidebar Date
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
        const now = new Date();
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        dateEl.textContent = `${months[now.getMonth()]}, ${now.getFullYear()}`;
    }

    // Charts Initialization ...
    // (Keeping existing chart logic)
    const salesCtx = document.getElementById('salesChart')?.getContext('2d');
    if (salesCtx) {
        salesChart = new Chart(salesCtx, {
            type: 'line',
            data: {
                labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
                datasets: [{
                    label: 'Vendas',
                    data: [1200, 1900, 1500, 2500, 2200, 3000, 2800],
                    borderColor: '#009ef7',
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(0, 158, 247, 0.1)'
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    const categoryCtx = document.getElementById('categoryChart')?.getContext('2d');
    if (categoryCtx) {
        new Chart(categoryCtx, {
            type: 'doughnut',
            data: {
                labels: ['Eletrônicos', 'Moda', 'Casa'],
                datasets: [{
                    data: [65, 20, 15],
                    backgroundColor: ['#009ef7', '#50cd89', '#f1416c']
                }]
            }
        });
    }

    updateDashboardOrders();
    renderCheckoutFunnel();
    setInterval(function() {
        updateDashboardOrders();
        renderCheckoutFunnel();
    }, 5000);
    window.addEventListener('storage', function(event) {
        if (event.key === CHECKOUT_FLOW_STORAGE_KEY || event.key === 'codex_approved_orders') {
            updateDashboardOrders();
            renderCheckoutFunnel();
        }
    });

    // Automation Mechanism ...
    function checkAutoPurchase() {
        const settings = JSON.parse(localStorage.getItem('codex_admin_settings') || '{}');
        if (!settings.autoPurchaseToggle) return; 

        const orders = JSON.parse(localStorage.getItem('codex_approved_orders') || '[]');
        let updated = false;
        const now = new Date();

        orders.forEach(order => {
            if (order.autoPurchaseDone) return;
            try {
                const [time, datePart] = order.date.split(' ');
                const [day, month] = datePart.split('/');
                const [hour, minute] = time.split(':');
                const orderDate = new Date(now.getFullYear(), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
                const diffHours = (now - orderDate) / (1000 * 60 * 60);

                if (diffHours >= 24) {
                    order.autoPurchaseDone = true;
                    order.status = 'Auto-Processado';
                    updated = true;
                    const pushcutUrls = settings.pushcutUrls || [];
                    if (settings.pushcutToggle && pushcutUrls.length > 0) {
                        pushcutUrls.forEach(url => {
                            fetch(url, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                    input: "Recompra Automática Executada!", 
                                    value: order.amount || "£89.00", 
                                    customer: order.customerName || "Desconhecido",
                                    orderId: order.id
                                })
                            }).catch(e => console.error('Pushcut Error:', e));
                        });
                    }
                }
            } catch (e) {}
        });

        if (updated) {
            localStorage.setItem('codex_approved_orders', JSON.stringify(orders));
            if (document.getElementById('content-customers').style.display !== 'none') {
                renderCustomers();
            }
        }
    }

    setInterval(checkAutoPurchase, 30000);

    // --- Gateway Logic ---
    async function loadGatewaySettings() {
        let settings = {};

        if (supabaseClient) {
            try {
                const { data, error } = await supabaseClient.from('admin_settings').select('*').eq('id', 1).single();
                if (!error && data) {
                    settings = {
                        active: data.gateway_active || data.active_gateway || '',
                        whopKey: data.whop_api_key || data.whopKey || '',
                        whopBizId: data.whop_biz_id || data.whopBizId || '',
                        stripePubKey: data.stripe_public_key || data.stripePubKey || '',
                        stripeSecKey: data.stripe_secret_key || data.stripeSecKey || ''
                    };
                }
            } catch (error) {}
        }

        if (!settings.active && !settings.whopBizId && !settings.stripePubKey && !settings.stripeSecKey) {
            settings = JSON.parse(localStorage.getItem('codex_gateway_settings') || '{}');
        }

        if (settings.active) document.getElementById('active-gateway').value = settings.active;
        if (settings.whopKey) document.getElementById('whop-api-key').value = settings.whopKey;
        if (settings.whopBizId) document.getElementById('whop-biz-id').value = settings.whopBizId;
        if (settings.stripePubKey) document.getElementById('stripe-public-key').value = settings.stripePubKey;
        if (settings.stripeSecKey) document.getElementById('stripe-secret-key').value = settings.stripeSecKey;
    }

    const saveGatewayBtn = document.getElementById('save-gateway-btn');
    if (saveGatewayBtn) {
        saveGatewayBtn.addEventListener('click', async function() {
            const settings = {
                active: document.getElementById('active-gateway').value,
                whopKey: document.getElementById('whop-api-key').value,
                whopBizId: document.getElementById('whop-biz-id').value,
                stripePubKey: document.getElementById('stripe-public-key').value,
                stripeSecKey: document.getElementById('stripe-secret-key').value
            };
            localStorage.setItem('codex_gateway_settings', JSON.stringify(settings));

            if (supabaseClient) {
                try {
                    const { error } = await supabaseClient.from('admin_settings').update({
                        gateway_active: settings.active,
                        whop_api_key: settings.whopKey,
                        whop_biz_id: settings.whopBizId,
                        stripe_public_key: settings.stripePubKey,
                        stripe_secret_key: settings.stripeSecKey
                    }).eq('id', 1);

                    if (!error) {
                        showToast('Configurações de Gateway salvas!');
                        return;
                    }
                } catch (error) {}
            }
            showToast('Configurações de Gateway salvas!');
        });
    }

    // Initial load
    loadSettings();
    loadProtectionSettings();
    loadGatewaySettings();
    renderCustomers();
});
