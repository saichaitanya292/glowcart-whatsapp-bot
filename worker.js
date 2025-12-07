export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- 1. WEBHOOK VERIFICATION (GET REQUEST) ---
    if (request.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === "glowcart123") {
        return new Response(challenge, { status: 200 });
      }
      return new Response("Verification failed", { status: 403 });
    }

    // --- 2. HANDLE INCOMING WHATSAPP MESSAGES (POST REQUEST) ---
    if (request.method === "POST") {
      const body = await request.json().catch(() => null);

      if (!body) {
        return new Response("Invalid JSON", { status: 400 });
      }

      // Extract user message
      const entry = body.entry?.[0]?.changes?.[0]?.value;
      const message = entry?.messages?.[0];
      const from = message?.from;
      const text = message?.text?.body;

      console.log("Incoming message:", text);

      // Auto-reply text
      const replyText = "Hi! 👋 Thanks for messaging GlowCart.\nReply:\n1️⃣ View Products\n2️⃣ Track Order\n3️⃣ Contact Support";

      // Send reply using WhatsApp API
      if (from) {
        await fetch(`https://graph.facebook.com/v20.0/${entry.metadata.phone_number_id}/messages`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: from,
            type: "text",
            text: { body: replyText }
          })
        });
      }

      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    return new Response("GlowCart Bot Running", { status: 200 });
  }
};
