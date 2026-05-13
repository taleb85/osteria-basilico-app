export const config = {
  matcher: '/i/:path*',
};

export default function middleware(request: Request) {
  const userAgent = request.headers.get('user-agent') || '';
  if (!/iPhone|iPad|iPod/.test(userAgent)) return;

  const url = new URL(request.url);
  const mobileconfigUrl = new URL('/Installa_FLOW.mobileconfig', url.origin).href;

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>FLOW — Installazione</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f7;display:flex;align-items:center;justify-content:center;padding:24px}
.card{background:#fff;border-radius:20px;padding:40px 32px;max-width:380px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.logo{width:80px;height:80px;border-radius:20px;margin:0 auto 20px;background:linear-gradient(135deg,#0066cc,#5856d6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:32px;font-weight:700}
h1{font-size:22px;font-weight:700;color:#1d1d1f;margin-bottom:8px}
p{font-size:15px;color:#6e6e73;line-height:1.5;margin-bottom:24px}
.btn{display:inline-block;background:#0066cc;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:17px;font-weight:600;-webkit-tap-highlight-color:transparent;width:100%;transition:opacity .15s}
.btn:active{opacity:.7}
.note{font-size:13px;color:#8e8e93;margin-top:20px;line-height:1.4}
</style>
</head>
<body>
<div class="card">
<div class="logo">FL</div>
<h1>Installa FLOW sul tuo iPhone</h1>
<p>Tocca il pulsante qui sotto per installare il profilo di configurazione.</p>
<a class="btn" href="${mobileconfigUrl}">Scarica profilo di configurazione</a>
<p class="note">Dopo il download, vai su <strong>Impostazioni &rarr; Profilo scaricato</strong> e tocca <strong>Installa</strong>.</p>
</div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
