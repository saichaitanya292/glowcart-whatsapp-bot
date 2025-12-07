export default {
  async fetch(request, env) {
    // For Meta Webhook Verification (GET)
    if (request.method === "GET") {
      const url = new URL(request.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === env.VERIFY_TOKEN) {
        return new Response(challenge, { status: 200 });
      }

      return new Response("WhatsApp Bot Live", { status: 200 });
    }

    // For incoming WhatsApp messages (POST)
    if (request.method === "POST") {
      let raw = await request.text();
      console.log("Incoming Webhook:", raw);

      let data = JSON.parse(raw);
      let entry = data.entry?.[0];
      let change = entry?.changes?.[0];
      let message = change?.value?.messages?.[0];

      if (!message) {
        console.log("No message to process");
        return new Response("OK", { status: 200 });
      }

      let from = message.from;
      let text = message.text?.body || "";

      console.log("User:", from, "Message:", text);

      // Reply back to sender
      let replyPayload = {
        messaging_product: "whatsapp",
        to: from,
        text: { body: `You said: ${text}` }
      };

      let graphResp = await fetch(
        `https://graph.facebook.com/v17.0/${env.PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.WABA_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(replyPayload),
        }
      );

      let graphResult = await graphResp.text();
      console.log("Graph API Response:", graphResp.status, graphResult);

      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    return new Response("Method Not Allowed", { status: 405 });
  },
};
