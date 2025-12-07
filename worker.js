export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Always allow browser GET check
    if (request.method === "GET") {
      // Webhook Verification Logic
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === env.VERIFY_TOKEN) {
        return new Response(challenge, { status: 200 });
      }

      // Normal GET request → show bot is online
      return new Response("GlowCart WhatsApp Bot is LIVE ✓", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Handle incoming WhatsApp Webhook events
    if (request.method === "POST") {
      const data = await request.json();

      try {
        const message =
          data.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body || "";
        const from =
          data.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;

        // Auto reply
        if (message && from) {
          await fetch(
            `https://graph.facebook.com/v18.0/${env.PHONE_NUMBER_ID}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${env.WABA_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: from,
                text: { body: `You said: ${message}` },
              }),
            }
          );
        }
      } catch (err) {
        console.error("Webhook error:", err);
      }

      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    return new Response("OK", { status: 200 });
  },
};
