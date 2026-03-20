(function() {
  var FLOW_STORAGE_KEY = 'codex_checkout_flow_sessions';
  var FLOW_SESSION_KEY = 'codex_checkout_flow_session_id';
  var FLOW_STALE_MS = 90 * 1000;
  var LAST_ORDER_SUMMARY_KEY = 'codex_last_order_summary';
  var flowSessionId = sessionStorage.getItem(FLOW_SESSION_KEY);
  var checkoutConfigCache = null;

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
    return String(value).replace(/\s+/g, ' ').trim();
  }

  function parseMoney(value) {
    var numeric = parseFloat(String(value || '0').replace(/[^0-9.]/g, ''));
    return isNaN(numeric) ? 0 : numeric;
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

  function showToast(message, type) {
    var color = type === 'error' ? '#b12704' : '#007600';
    var toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;background:#fff;border:1px solid ' + color + ';color:' + color + ';padding:12px 16px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.12);font-family:Arial,sans-serif;font-size:14px;max-width:320px;';
    document.body.appendChild(toast);
    setTimeout(function() {
      toast.remove();
    }, 3500);
  }

  async function fetchCheckoutConfig() {
    if (checkoutConfigCache) return checkoutConfigCache;

    try {
      var response = await fetch('/api/checkout-config', { cache: 'no-store' });
      if (!response.ok) throw new Error('Config unavailable');
      checkoutConfigCache = await response.json();
    } catch (error) {
      checkoutConfigCache = {
        gatewayActive: 'none',
        stripePublicKey: '',
        whopBizId: ''
      };
    }

    return checkoutConfigCache;
  }

  function getSafeOrderSummary(order) {
    return {
      id: order.id || '',
      customer_name: order.customer_name || '',
      product_name: order.product_name || '',
      product_image: order.product_image || '',
      value: order.value || '',
      status: order.status || ''
    };
  }

  async function saveOrder(orderPayload) {
    var response = await fetch('/api/save-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });

    var data = await response.json();
    if (!response.ok) {
      throw new Error(data && data.detail ? data.detail : 'Nao foi possivel salvar o pedido.');
    }

    sessionStorage.setItem(LAST_ORDER_SUMMARY_KEY, JSON.stringify(getSafeOrderSummary(data)));
    return data;
  }

  async function createStripeCheckout(orderPayload, amount, productName) {
    var response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order: orderPayload,
        amount: amount,
        productName: productName,
        successUrl: window.location.origin + '/success.html',
        cancelUrl: window.location.href
      })
    });

    var data = await response.json();
    if (!response.ok || !data.url) {
      throw new Error(data && data.detail ? data.detail : 'Falha ao iniciar pagamento seguro.');
    }

    if (data.order) {
      sessionStorage.setItem(LAST_ORDER_SUMMARY_KEY, JSON.stringify(getSafeOrderSummary(data.order)));
    }

    return data;
  }

  function updatePaymentVisibility(config) {
    var paymentForm = getElement('payment-form');
    var helperText = getElement('payment-helper-text');
    var paymentSection = getElement('payment-section');
    var requiredFields = [
      getElement('name'),
      getElement('address'),
      getElement('city'),
      getElement('zip'),
      getElement('phone')
    ];

    var isComplete = requiredFields.every(isFilled);
    var hasProduct = !!product;
    var gateway = config && config.gatewayActive ? config.gatewayActive : 'none';

    if (paymentForm) {
      paymentForm.style.display = 'none';
    }

    if (paymentSection) {
      paymentSection.style.display = hasProduct ? 'block' : 'none';
    }

    if (helperText) {
      if (!hasProduct) {
        helperText.textContent = 'Please add a product to your cart first.';
      } else if (!isComplete) {
        helperText.textContent = 'Fill in the delivery address to continue.';
      } else if (gateway === 'stripe') {
        helperText.textContent = 'You will enter card details on Stripe secure checkout.';
      } else if (gateway === 'whop') {
        helperText.textContent = 'You will finish payment on the external secure checkout page.';
      } else {
        helperText.textContent = 'Your order will be recorded and sent for manual processing.';
      }
    }

    if (hasProduct && isComplete) {
      updateCheckoutStage('address_completed');
    }
  }

  async function initBootAutomation() {
    var bootParams = new URLSearchParams(window.location.search);
    if (bootParams.get('order_boot') !== '1') return;

    var reorderData = JSON.parse(localStorage.getItem('codex_reorder_session') || '{}');
    if (!reorderData.product) return;

    sessionStorage.setItem('codexCheckoutProduct', JSON.stringify({
      title: reorderData.product,
      price: reorderData.value,
      image: reorderData.productImage
    }));

    if (reorderData.name && getElement('name')) getElement('name').value = reorderData.name;
    if (reorderData.address && getElement('address')) getElement('address').value = reorderData.address;
    if (reorderData.city && getElement('city')) getElement('city').value = reorderData.city;
    if (reorderData.zip && getElement('zip')) getElement('zip').value = reorderData.zip;
    if (reorderData.phone && getElement('phone')) getElement('phone').value = reorderData.phone;

    showToast('Dados da entrega carregados para nova compra.');
    localStorage.removeItem('codex_reorder_session');
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
      mainContent.innerHTML = '\
        <div style="text-align:center;padding:50px 20px;">\
          <h2>Your Cart is Empty</h2>\
          <p>Please add a product to your cart before proceeding to checkout.</p>\
          <a href="/" class="btn-primary" style="display:inline-block;width:auto;text-decoration:none;padding:10px 20px;">Return to Shop</a>\
        </div>';
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
    if (!field) return;

    var markAddressStarted = function() {
      if (isFilled(field)) {
        updateCheckoutStage('address_started');
      }
    };

    field.addEventListener('focus', function() {
      updateCheckoutStage('address_started');
    });
    field.addEventListener('blur', markAddressStarted);
    field.addEventListener('input', markAddressStarted);
    field.addEventListener('change', markAddressStarted);
  });

  (async function() {
    var config = await fetchCheckoutConfig();
    await initBootAutomation();
    updatePaymentVisibility(config);

    ['name', 'address', 'city', 'zip', 'phone'].forEach(function(id) {
      var field = getElement(id);
      if (!field) return;
      field.addEventListener('input', function() {
        updatePaymentVisibility(config);
      });
      field.addEventListener('change', function() {
        updatePaymentVisibility(config);
      });
    });
  })();

  setInterval(async function() {
    var config = checkoutConfigCache || await fetchCheckoutConfig();
    var currentStage = 'checkout_view';
    if (isFilled(getElement('name')) || isFilled(getElement('address')) || isFilled(getElement('city')) || isFilled(getElement('zip')) || isFilled(getElement('phone'))) {
      currentStage = 'address_started';
    }
    if ([getElement('name'), getElement('address'), getElement('city'), getElement('zip'), getElement('phone')].every(isFilled)) {
      currentStage = 'address_completed';
    }
    if (config.gatewayActive !== 'none' && currentStage === 'address_completed') {
      currentStage = 'payment_started';
    }
    updateCheckoutStage(currentStage);
  }, 15000);

  var placeOrderBtn = getElement('place-order-btn-2');
  if (placeOrderBtn) {
    placeOrderBtn.addEventListener('click', async function() {
      try {
        var name = getElement('name').value.trim();
        var address = getElement('address').value.trim();
        var city = getElement('city').value.trim();
        var zip = getElement('zip').value.trim();
        var phone = getElement('phone').value.trim();

        if (!name || !address || !city || !zip || !phone) {
          alert('Please fill in all delivery details.');
          return;
        }

        placeOrderBtn.disabled = true;
        placeOrderBtn.textContent = 'Processing...';

        const urlParams = new URLSearchParams(window.location.search);
        const campaignId = urlParams.get('utm_campaign') ||
          urlParams.get('cid') ||
          localStorage.getItem('codex_active_campaign') ||
          'Organic';

        const realProductName = buildProductName(product);
        const orderValue = normalizePrice(product.price);
        const orderValueNumeric = parseMoney(orderValue);
        const config = await fetchCheckoutConfig();

        var orderPayload = {
          customer_name: name,
          address: address,
          city: city,
          zip: zip,
          phone: phone,
          product_name: realProductName,
          product_image: product.image || '',
          value: orderValue,
          status: config.gatewayActive === 'none' ? 'Capturado' : 'Pendente',
          campaign_id: campaignId
        };

        updateCheckoutStage('payment_started');

        if (config.gatewayActive === 'stripe') {
          var stripeSession = await createStripeCheckout(orderPayload, orderValueNumeric, realProductName);
          updateCheckoutStage('order_submitted', { orderId: stripeSession.order ? stripeSession.order.id : null });
          window.location.href = stripeSession.url;
          return;
        }

        if (config.gatewayActive === 'whop' && config.whopBizId) {
          var pendingOrder = await saveOrder(orderPayload);
          updateCheckoutStage('order_submitted', { orderId: pendingOrder.id || null });
          window.location.href = 'https://whop.com/checkout/' + encodeURIComponent(config.whopBizId) + '/?name=' + encodeURIComponent(realProductName) + '&price=' + encodeURIComponent(orderValueNumeric);
          return;
        }

        var savedOrder = await saveOrder(orderPayload);
        updateCheckoutStage('order_submitted', { orderId: savedOrder.id || null });
        window.location.href = 'success.html?order_id=' + encodeURIComponent(savedOrder.id || '');
      } catch (error) {
        console.error('Checkout error:', error);
        showToast(error.message || 'There was an error placing your order.', 'error');
        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = 'Place Your Order';
      }
    });
  }
})();
