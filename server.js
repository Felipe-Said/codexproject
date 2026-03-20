const http = require("http");
const fs = require("fs");
const path = require("path");

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jmjizeydpzdtqhedndyg.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

let supabaseClient = null;
try {
  const { createClient } = require('@supabase/supabase-js');
  if (SUPABASE_SERVICE_ROLE_KEY) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log('Supabase initialized in backend mode.');
  } else {
    console.warn('Supabase server key not found. API features may be unavailable.');
  }
} catch (e) {
  console.warn('Supabase SDK not found in backend. Using native fetch for APIs.');
}

const base = __dirname;
const port = 8000;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const relativePath = urlPath.replace(/^\/+/, "");
    const filePath = path.resolve(base, relativePath);

    if (!filePath.startsWith(base)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    if (urlPath === "/") {
      fs.readdir(base, { withFileTypes: true }, (error, entries) => {
        if (error) {
          res.writeHead(500);
          res.end("Failed to read directory");
          return;
        }

        const items = entries
          .filter((entry) => entry.name !== "server.js")
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
          .map((entry) => {
            const slash = entry.isDirectory() ? "/" : "";
            const href = encodeURI(`/${entry.name}${slash}`);
            return `<li><a href="${href}">${entry.name}${slash}</a></li>`;
          })
          .join("");

        const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Codex AMZ</title>
    <style>
      body { font-family: Segoe UI, Arial, sans-serif; margin: 32px; background: #f6f7fb; color: #1f2937; }
      h1 { margin-bottom: 8px; }
      p { margin-top: 0; color: #4b5563; }
      ul { padding-left: 20px; }
      li { margin: 10px 0; }
      a { color: #0f62fe; text-decoration: none; }
      a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <h1>Codex AMZ</h1>
    <p>Arquivos disponíveis nesta pasta:</p>
    <ul>${items}</ul>
  </body>
</html>`;

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
      });
      return;
    }

    // --- Backend API: Protection Settings ---
    if (urlPath === "/api/protection-settings" && req.method === "GET") {
        const fetchSettings = async () => {
            try {
                // Using native fetch to avoid strictly requiring @supabase/supabase-js in node_modules if not installed
                const response = await fetch(`${SUPABASE_URL}/rest/v1/admin_settings?id=eq.1&select=*`, {
                    headers: {
                        'apikey': SUPABASE_SERVICE_ROLE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                    }
                });
                const data = await response.json();
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(data[0] || {}));
            } catch (error) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: error.message }));
            }
        };
        fetchSettings();
        return;
    }

    // --- Backend API for Production Gateways ---
    if (urlPath === "/api/create-checkout-session" && req.method === "POST") {
      let body = "";
      req.on("data", chunk => { body += chunk.toString(); });
      req.on("end", async () => {
        try {
          const { stripeSecretKey, productName, amount, successUrl, cancelUrl } = JSON.parse(body);
          
          // Using standard fetch to communicate with Stripe API directly 
          // (Requires 'stripe' package in a real environment, but here we show the structure)
          const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${stripeSecretKey}`,
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
              "payment_method_types[]": "card",
              "line_items[0][price_data][currency]": "gbp",
              "line_items[0][price_data][product_data][name]": productName,
              "line_items[0][price_data][unit_amount]": Math.round(amount * 100),
              "line_items[0][quantity]": "1",
              "mode": "payment",
              "success_url": successUrl,
              "cancel_url": cancelUrl
            })
          });
          
          const session = await response.json();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ id: session.id, url: session.url }));
        } catch (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
      });
      res.end(data);
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Serving ${base} at http://127.0.0.1:${port}`);
  });
