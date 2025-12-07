export default {
  async fetch(request, env) {
    return new Response("GlowCart WhatsApp Bot is live!", {
      status: 200,
      headers: { "Content-Type": "text/plain" }
    });
  }
};
