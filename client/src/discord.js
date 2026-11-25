export let discordSdk = null;

const STORAGE_TOKEN_KEY = 'bunker_discord_token';

/**
 * Setup Discord SDK and get user info.
 * Safe to call outside Discord — returns null user.
 */
export async function setupDiscord() {
  try {
    const { DiscordSDK } = await import("@discord/embedded-app-sdk");
    const CLIENT_ID = import.meta.env.VITE_CLIENT_ID || "1574931331341750383";
    discordSdk = new DiscordSDK(CLIENT_ID);
    await discordSdk.ready();

    // 0. Try cached access_token first so the user is never asked to authorize again
    try {
      const savedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
      if (savedToken) {
        const auth = await discordSdk.commands.authenticate({ access_token: savedToken });
        if (auth?.user) {
          return {
            ready: true,
            inDiscord: true,
            user: {
              id: auth.user.id,
              username: auth.user.global_name || auth.user.username,
              avatar: auth.user.avatar,
              avatarUrl: auth.user.avatar
                ? `https://cdn.discordapp.com/avatars/${auth.user.id}/${auth.user.avatar}.png?size=128`
                : null,
            },
          };
        }
      }
    } catch {
      // Cached token expired or invalid — continue to OAuth flow
      try { localStorage.removeItem(STORAGE_TOKEN_KEY); } catch {}
    }

    // 1. Authorize with Discord Client (only 'identify' needed; try silent first, then consent if needed)
    let authCode = null;
    try {
      const res = await discordSdk.commands.authorize({
        client_id: CLIENT_ID,
        response_type: "code",
        state: "",
        prompt: "none",
        scope: ["identify"],
      });
      authCode = res?.code;
    } catch (silentErr) {
      console.warn('[Discord] Silent authorize failed, prompting consent:', silentErr?.message || silentErr);
      const res = await discordSdk.commands.authorize({
        client_id: CLIENT_ID,
        response_type: "code",
        state: "",
        scope: ["identify"],
      });
      authCode = res?.code;
    }

    if (!authCode) {
      return { ready: true, inDiscord: true, user: null, error: 'No authorization code' };
    }

    // 2. Exchange authorization code for access token & user profile via backend API
    // Inside Discord Activity iframe, relative backend routes go through /.proxy/...
    const endpoints = [
      '/.proxy/api/token',
      '/api/token',
      'https://bunker-discord-activity.onrender.com/api/token',
    ];

    let tokenRes = null;
    let lastErr = '';
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: authCode }),
        });
        if (res.ok) {
          tokenRes = res;
          break;
        } else {
          lastErr = `${url} -> HTTP ${res.status}`;
        }
      } catch (fetchErr) {
        lastErr = `${url} -> ${fetchErr?.message || 'network error'}`;
      }
    }

    if (tokenRes && tokenRes.ok) {
      const { access_token, user: serverUser } = await tokenRes.json();
      try { localStorage.setItem(STORAGE_TOKEN_KEY, access_token); } catch {}

      // 3. Authenticate SDK session
      const auth = await discordSdk.commands.authenticate({ access_token });
      const user = auth?.user || serverUser;

      if (user) {
        return {
          ready: true,
          inDiscord: true,
          user: {
            id: user.id,
            username: user.global_name || user.username,
            avatar: user.avatar,
            avatarUrl: user.avatar
              ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
              : null,
          },
        };
      }
      return { ready: true, inDiscord: true, user: null, error: 'User object missing' };
    } else {
      console.error('[Discord] Token exchange failed on all endpoints:', lastErr);
      return { ready: true, inDiscord: true, user: null, error: lastErr || 'Token exchange failed' };
    }
  } catch (e) {
    console.warn('[Discord] Not in Discord iframe or auth failed:', e?.message || e);
    const inIframe = typeof window !== 'undefined' && window.self !== window.top;
    return { ready: false, inDiscord: inIframe, user: null, error: e?.message || String(e) };
  }
}
