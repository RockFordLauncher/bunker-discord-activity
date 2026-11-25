export let discordSdk = null;

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

    // 1. Authorize with Discord Client
    const { code } = await discordSdk.commands.authorize({
      client_id: CLIENT_ID,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: ["identify", "guilds"],
    });

    // 2. Exchange authorization code for access token via backend API
    const tokenRes = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).catch(() => fetch('https://bunker-discord-activity.onrender.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }));

    if (tokenRes && tokenRes.ok) {
      const { access_token } = await tokenRes.json();
      // 3. Authenticate SDK session
      const auth = await discordSdk.commands.authenticate({ access_token });
      const user = auth?.user || await (await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` },
      })).json();

      return {
        ready: true,
        user: {
          id: user.id,
          username: user.global_name || user.username,
          avatar: user.avatar,
          avatarUrl: user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
            : null,
        },
      };
    } else {
      const errBody = tokenRes ? await tokenRes.text() : 'No response';
      console.error('[Discord] Token exchange failed:', tokenRes?.status, errBody);
      return { ready: true, user: null, error: errBody };
    }
  } catch (e) {
    console.warn('[Discord] Not in Discord iframe or auth failed:', e.message);
    return { ready: false, user: null, error: e.message };
  }
}
