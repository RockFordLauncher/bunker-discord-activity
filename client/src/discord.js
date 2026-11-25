export let discordSdk = null;

/**
 * Setup Discord SDK and get user info.
 * Safe to call outside Discord — returns null user.
 */
export async function setupDiscord() {
  try {
    const { DiscordSDK } = await import("@discord/embedded-app-sdk");
    const CLIENT_ID = import.meta.env.VITE_CLIENT_ID || "placeholder_id";
    discordSdk = new DiscordSDK(CLIENT_ID);
    await discordSdk.ready();

    const { code } = await discordSdk.commands.authorize({
      client_id: CLIENT_ID,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: ["identify", "guilds"],
    });

    const tokenRes = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    if (tokenRes.ok) {
      const { access_token } = await tokenRes.json();
      await discordSdk.commands.authenticate({ access_token });

      const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const user = await userRes.json();
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
    }
    return { ready: true, user: null };
  } catch (e) {
    console.warn('[Discord] Not in Discord iframe or auth failed:', e.message);
    return { ready: false, user: null };
  }
}
