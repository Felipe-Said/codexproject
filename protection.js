(async function() {
    // Campaign Attribution Persistence
    const urlParams = new URLSearchParams(window.location.search);
    const campaign = urlParams.get('utm_campaign') || urlParams.get('cid');
    if (campaign) {
        localStorage.setItem('codex_active_campaign', campaign);
        console.log('Campaign persisted:', campaign);
    }

    // Check if current page should be protected
    const currentPage = decodeURIComponent(window.location.pathname.split('/').pop()) || 'index.html';
    
    // EXCLUSION: Admin and core system pages should never be cloaked
    const systemPages = ['admin.html', 'login.html', 'success.html'];
    if (systemPages.includes(currentPage)) {
        console.log('Codex Protection: System Page detected. Cloaker skipped.');
        return;
    }
    let settings = { protection_enabled: true, block_desktop: true, block_brazil: true, block_bots: true, protected_pages: {} };
    try {
        const response = await fetch('/api/protection-settings');
        settings = await response.json();
    } catch (e) {
        console.warn('Proteção: Erro ao carregar configurações do servidor. Usando padrões de segurança.');
    }

    const isPageProtected = settings.protected_pages && settings.protected_pages[currentPage] ? settings.protected_pages[currentPage].active : true;

    // Helper: Inject Pixels
    function injectPixels(s) {
        console.log('Codex: Sincronizando Pixels...');
        if (s.fb_pixel) {
            const script = document.createElement('script');
            script.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '${s.fb_pixel}');fbq('track', 'PageView');`;
            document.head.appendChild(script);
        }
        if (s.ga_pixel) {
            const script = document.createElement('script');
            script.async = true;
            script.src = `https://www.googletagmanager.com/gtag/js?id=${s.ga_pixel}`;
            document.head.appendChild(script);
            const inline = document.createElement('script');
            inline.innerHTML = `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${s.ga_pixel}');`;
            document.head.appendChild(inline);
        }
        if (s.tt_pixel) {
            const script = document.createElement('script');
            script.innerHTML = `!function (w, d, t) { w.TTPixelStack = []; w.ttq = w.ttq || []; w.ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "setAndVerify", "send"]; w.ttq.setAndVerify = function (n, t, e) { n.set(t, e); return n; }; w.ttq.load = function (e, n) { var i = "https://analytics.tiktok.com/i18n/pixel/events.js"; w.ttq._i = w.ttq._i || {}; w.ttq._i[e] = []; w.ttq._i[e]._u = i; w.ttq._t = w.ttq._t || {}; w.ttq._t[e] = +new Date; w.ttq._o = w.ttq._o || {}; w.ttq._o[e] = n || {}; n = d.createElement("script"); n.type = "text/javascript"; n.async = !0; n.src = i + "?sdkid=" + e + "&lib=" + t; e = d.getElementsByTagName("script")[0]; e.parentNode.insertBefore(n, e) }; w.ttq.load('${s.tt_pixel}'); w.ttq.page(); }(window, document, 'ttq');`;
            document.head.appendChild(script);
        }
    }

    // Always inject pixels on both clean/black pages
    injectPixels(settings);

    // If on safe page, stop here (already injected pixels)
    if (currentPage === 'culinaria.html') {
        console.log('Codex: Safe Page Active (Pixels Synced)');
        return;
    }

    if (settings.protection_enabled === false || !isPageProtected) {
        console.log('Proteção desativada para esta página.');
        return;
    }

    // --- Cloaker Logic: Device/IP/Bot/Campaign Filtering ---
    const ua = navigator.userAgent.toLowerCase();
    const hasCampaign = !!campaign || urlParams.get('fbclid') || urlParams.get('gclid') || urlParams.get('ttclid');
    let shouldShield = false;

    // 1. Campaign Guard: No campaign parameter = Auto-shield (Prevents direct access to files)
    if (!hasCampaign) {
        console.log('Codex Protection: No campaign parameter detected. Shielding...');
        shouldShield = true;
    }

    const botPatterns = [
        'googlebot', 'adsbot', 'meta-external', 'facebot', 'facebookexternalhit', 
        'tiktokbot', 'adsbot-google', 'baiduspider', 'bingbot', 'twitterbot',
        'scanners', 'crawler', 'spider'
    ];

    try {
        // 1. Bot Check (Always first)
        if (settings.block_bots) {
            if (botPatterns.some(p => ua.includes(p))) shouldShield = true;
        }

        // 2. Desktop Check
        if (settings.block_desktop && !shouldShield) {
            const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
            if (!isMobile) shouldShield = true;
        }

        // 3. Brazil Check (IP Geolocation)
        if (settings.block_brazil && !shouldShield) {
            try {
                const res = await fetch('https://ipapi.co/json/');
                const data = await res.json();
                if (data.country_code === 'BR') shouldShield = true;
            } catch (e) {
                // If API fails, we err on the side of caution? Or allow?
                // For now, allow (user might be offline)
            }
        }

        if (shouldShield) {
            console.log('Codex Protection: BOT/OFF-TARGET detected. Redirecting to Safe Page...');
            window.location.href = 'culinaria.html';
            return;
        }

        // If we are on the entry point (index.html or root) and NOT shielded, go to home.html
        const actualPath = window.location.pathname.split('/').pop();
        if (actualPath === 'index.html' || actualPath === '') {
            console.log('Codex: User Valid. Transitioning to Home...');
            window.location.href = 'home.html';
        }
    } catch (e) {
        console.error('Cloaker Error:', e);
    }
})();
