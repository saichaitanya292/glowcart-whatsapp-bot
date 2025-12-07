// GlowCart WhatsApp Bot – Webhook + Auto-reply

export default {
  async fetch(request, env) {
    const { searchParams } = new URL(request.url);

    // 1. Webhook verification (Meta calls this with GET once)
    if (request.method === "GET") {
      const mode = searchParams.get("hub.mode");
      const token = searchParams.get("hub.verify_token");
      const challenge = searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === "glowcart123") {
        // token must match the one you typed in Meta config
        return new Response(challenge, { status: 200 });
      }

      return new Response("Verification failed", { status: 403 });
    }

    // 2. Incoming messages (Meta calls this with POST)
    if (request.method === "POST") {
      const body = await request.json();
      console.log("Incoming payload:", JSON.stringify(body, null, 2));

      try {
        const value = body?.entry?.[0]?.changes?.[0]?.value;
        const messages = value?.messages;

        if (messages && messages.length > 0) {
          // handle each incoming message
          for (const msg of messages) {
            const from = msg.from; // user phone number in international format
            let userText = "";

            if (msg.type === "text") {
              userText = msg.text?.body || "";
            } else if (msg.type === "interactive") {
              // button / list replies
              userText =
                msg.interactive?.button_reply?.title ||
                msg.interactive?.list_reply?.title ||
                "";
            }

            // send auto reply
            await sendWhatsAppReply(env, from, userText);
          }
        }
      } catch (err) {
        console.error("Error handling message:", err);
      }

      // Always respond 200 so Meta knows we received the event
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    // For any other requests (optional)
    return new Response("GlowCart WhatsApp Bot is live!", { status: 200 });
  }
};

// Helper: send reply back to user via WhatsApp Cloud API
async function sendWhatsAppReply(env, to, userText) {
  const phoneId = env.WHATSAPP_PHONE_ID; // e.g. "123456789012345"
  const token = env.WHATSAPP_TOKEN;      // your access token (secret)

  const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;

  const replyBody = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: {
      preview_url: false,
      body:
        userText && userText.trim().length > 0
          ? `Hi 👋, thanks for messaging GlowCart!\n\nYou said: "${userText}".\nOur team will get back to you soon.`
          : `Hi 👋, thanks for contacting GlowCart! How can we help you today?`
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(replyBody)
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Error sending WhatsApp message:", res.status, errorText);
  } else {
    console.log("Reply sent to", to);
  }
}
