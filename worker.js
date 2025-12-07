export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Webhook verification (GET)
    if (request.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      // VERIFY_TOKEN must match what you put in Meta config
      if (mode === "subscribe" && token === env.VERIFY_TOKEN) {
        return new Response(challenge, { status: 200 });
      } else {
        return new Response("Forbidden", { status: 403 });
      }
    }

    // 2. Incoming messages (POST)
    if (request.method === "POST") {
      let data;
      try {
        data = await request.json();
        console.log("Incoming webhook:", JSON.stringify(data));

        const entry = data.entry?.[0];
        const change = entry?.changes?.[0];
        const message = change?.value?.messages?.[0];

        // Only reply to real user messages
        if (message && message.type === "text") {
          const from = message.from;          // user’s phone number
          const text = message.text.body;     // user’s message

          // Build reply text
          const replyText =
            `Hi! 👋 This is *GlowCart*.\n` +
            `You said: "${text}".\n\n` +
            `Try sending:\n` +
            `1️⃣ products – to see items\n` +
            `2️⃣ help – to contact support`;

          // Send reply via WhatsApp Cloud API
          const url = `https://graph.facebook.com/v21.0/${env.PHONE_NUMBER_ID}/messages`;

          const payload = {
            messaging_product: "whatsapp",
            to: from,
            type: "text",
            text: { body: replyText }
          };

          const resp = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${env.WABA_TOKEN}`,
            },
            body: JSON.stringify(payload),
          });

          const respBody = await resp.text();
          console.log("Send message response:", resp.status, respBody);
        }

      } catch (err) {
        console.error("Error handling webhook:", err);
      }

      // Always respond 200 so Meta knows we received it
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    // Fallback
    return new Response("GlowCart WhatsApp Bot is running", { status: 200 });
  },
};
