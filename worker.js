export default {
  async fetch(request, env) {
    const { searchParams } = new URL(request.url);

    // === 1. Webhook Verification ===
    if (request.method === "GET") {
      const mode = searchParams.get("hub.mode");
      const token = searchParams.get("hub.verify_token");
      const challenge = searchParams.get("hub.challenge");

      // IMPORTANT: Match the verify token used in Meta Config
      if (mode === "subscribe" && token === "glowcart123") {
        return new Response(challenge, { status: 200 }); 
      }

      return new Response("Verification failed", { status: 403 });
    }

    // === 2. Handle Incoming Messages ===
    if (request.method === "POST") {
      const body = await request.json();
      console.log("Incoming WhatsApp message:", body);

      // Always return 200 so Meta knows webhook was received
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    return new Response("GlowCart WhatsApp Bot is live!", { status: 200 });
  }
};
