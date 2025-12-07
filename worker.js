// GlowCart WhatsApp E-commerce Bot
// Cloudflare Worker

// In-memory session store (per Worker instance).
// For real production you’d move this to Durable Objects or KV.
const sessions = new Map();

const PRODUCTS = [
  { id: 1, name: "Dew Kiss Rose Serum (30 ml)", price: 699 },
  { id: 2, name: "CloudSoft Day Cream (50 g)", price: 890 },
  { id: 3, name: "Milky Melt Cleanser (100 ml)", price: 549 },
  { id: 4, name: "GlowPop Lip Balm Duo", price: 499 },
  { id: 5, name: "MoonClay Detox Mask", price: 799 },
  { id: 6, name: "CloudMist Face Spray", price: 399 }
];

const STATE = {
  MAIN_MENU: "MAIN_MENU",
  BROWSING: "BROWSING",
  CHECKOUT_NAME: "CHECKOUT_NAME",
  CHECKOUT_ADDRESS: "CHECKOUT_ADDRESS",
  ORDER_PLACED: "ORDER_PLACED"
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === "GET") {
      return handleVerification(request, env);
    }

    if (request.method === "POST") {
      return handleWebhook(request, env, ctx);
    }

    return new Response("GlowCart WhatsApp Bot", { status: 200 });
  }
};

/**
 * STEP 1: Webhook verification (GET)
 */
function handleVerification(request, env) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Verification failed", { status: 403 });
}

/**
 * STEP 2: Incoming webhook (POST)
 */
async function handleWebhook(request, env, ctx) {
  const body = await request.json().catch(() => null);
  if (!body || !body.entry || !body.entry[0]?.changes) {
    return new Response("No entry", { status: 200 });
  }

  const change = body.entry[0].changes[0];
  const value = change.value;

  const message = value.messages?.[0];

  // We only care about user messages; status updates can be ignored
  if (!message || !message.from) {
    return new Response("No message", { status: 200 });
  }

  const from = message.from; // user's WhatsApp number
  const textBody =
    message.type === "text" ? (message.text?.body ?? "").trim() : "";

  // Handle only text for now
  if (!textBody) {
    await sendText(env, from, "Sorry, I currently understand only text messages 😊");
    return new Response("OK", { status: 200 });
  }

  // Process user message asynchronously
  ctx.waitUntil(handleUserMessage(env, from, textBody));

  return new Response("OK", { status: 200 });
}

/**
 * STEP 3: Conversation logic
 */
async function handleUserMessage(env, from, text) {
  const normalized = text.trim().toLowerCase();

  const session = getSession(from);
  console.log("Incoming from", from, "state:", session.state, "text:", text);

  // Global commands that work from any state
  if (["menu", "home", "start"].includes(normalized)) {
    resetSession(session);
    await sendMainMenu(env, from);
    return;
  }

  if (normalized === "clear") {
    session.cart = [];
    session.state = STATE.MAIN_MENU;
    await sendText(env, from, "🧹 Cart cleared.\n\n" + mainMenuText());
    return;
  }

  switch (session.state) {
    case STATE.MAIN_MENU:
      await handleMainMenuInput(env, from, session, normalized);
      break;

    case STATE.BROWSING:
      await handleBrowsingInput(env, from, session, normalized, text);
      break;

    case STATE.CHECKOUT_NAME:
      await handleCheckoutName(env, from, session, text);
      break;

    case STATE.CHECKOUT_ADDRESS:
      await handleCheckoutAddress(env, from, session, text);
      break;

    case STATE.ORDER_PLACED:
      // Any message after order goes back to menu
      resetSession(session);
      await sendMainMenu(env, from);
      break;

    default:
      // Unknown state – go back to menu
      resetSession(session);
      await sendMainMenu(env, from);
      break;
  }
}

/**
 * Session helpers
 */
function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, {
      state: STATE.MAIN_MENU,
      cart: [],
      checkout: {}
    });
  }
  return sessions.get(userId);
}

function resetSession(session) {
  session.state = STATE.MAIN_MENU;
  session.cart = [];
  session.checkout = {};
}

/**
 * MAIN MENU
 */
async function sendMainMenu(env, to) {
  await sendText(env, to, welcomeText());
}

function welcomeText() {
  return (
    "✨ Welcome to *GlowCart* – beauty that fits in one cart!\n\n" +
    "What would you like to do?\n\n" +
    "1️⃣ Browse glow essentials\n" +
    "2️⃣ View cart\n" +
    "3️⃣ Checkout\n\n" +
    "💡 You can type *menu* anytime to come back here.\n" +
    "Type a number (1-3) to continue."
  );
}

function mainMenuText() {
  return (
    "Main menu:\n\n" +
    "1️⃣ Browse glow essentials\n" +
    "2️⃣ View cart\n" +
    "3️⃣ Checkout\n\n" +
    "💡 Type *clear* to empty your cart."
  );
}

async function handleMainMenuInput(env, to, session, normalized) {
  if (normalized === "1" || normalized.includes("browse")) {
    session.state = STATE.BROWSING;
    await sendProductList(env, to);
  } else if (normalized === "2" || normalized.includes("cart")) {
    await sendCart(env, to, session);
  } else if (normalized === "3" || normalized.includes("checkout")) {
    if (session.cart.length === 0) {
      await sendText(
        env,
        to,
        "🛒 Your cart is empty.\nAdd something first by typing *1* to browse products."
      );
    } else {
      session.state = STATE.CHECKOUT_NAME;
      await sendText(
        env,
        to,
        "🧾 Let's checkout your GlowCart order.\n\nWhat name should we put on the order?"
      );
    }
  } else {
    await sendText(env, to, "Sorry, I didn't understand that.\n\n" + mainMenuText());
  }
}

/**
 * BROWSING PRODUCTS
 */
async function sendProductList(env, to) {
  let text = "🛍 *GlowCart Essentials*\n\n";
  PRODUCTS.forEach((p) => {
    text += `${p.id}. ${p.name} – ₹${p.price}\n`;
  });
  text +=
    "\nReply with the *number* of the product to add to cart.\n" +
    "Example: `1` to add Dew Kiss Rose Serum.\n\n" +
    "Type *cart* to see your cart or *menu* to go back.";
  await sendText(env, to, text);
}

async function handleBrowsingInput(env, to, session, normalized, rawText) {
  // Product selection by number
  const num = parseInt(normalized, 10);
  if (!isNaN(num)) {
    const product = PRODUCTS.find((p) => p.id === num);
    if (!product) {
      await sendText(env, to, "I don't have a product with that number. Try again 🙂");
      await sendProductList(env, to);
      return;
    }

    session.cart.push(product);
    const cartCount = session.cart.length;
    await sendText(
      env,
      to,
      `✨ Added *${product.name}* (₹${product.price}) to your cart.\n` +
        `You now have *${cartCount}* item(s).\n\n` +
        "Type another product number to keep adding,\n" +
        "or type *cart* to view cart, *checkout* to place order, or *menu* to go back."
    );
    return;
  }

  if (normalized === "cart") {
    await sendCart(env, to, session);
    return;
  }

  if (normalized === "checkout") {
    if (session.cart.length === 0) {
      await sendText(env, to, "Your cart is empty. Add something first by sending a number.");
    } else {
      session.state = STATE.CHECKOUT_NAME;
      await sendText(
        env,
        to,
        "🧾 Great choice!\nWhat name should we put on the order?"
      );
    }
    return;
  }

  if (normalized === "menu") {
    resetSession(session);
    await sendMainMenu(env, to);
    return;
  }

  // Fallback
  await sendText(
    env,
    to,
    "I expected a product number, *cart*, *checkout* or *menu*.\nPlease try again 🙂"
  );
}

/**
 * CART
 */
function formatCart(session) {
  if (!session.cart.length) return "Your cart is empty.";

  let text = "";
  let total = 0;
  session.cart.forEach((item, index) => {
    text += `${index + 1}. ${item.name} – ₹${item.price}\n`;
    total += item.price;
  });
  text += `\nSubtotal: *₹${total}*`;
  return text;
}

async function sendCart(env, to, session) {
  const text =
    "🛒 *Your GlowCart*\n\n" +
    formatCart(session) +
    "\n\nType *checkout* to place your order,\n" +
    "or *clear* to empty the cart, or *menu* to go back.";
  await sendText(env, to, text);
}

/**
 * CHECKOUT
 */
async function handleCheckoutName(env, to, session, name) {
  session.checkout.name = name.trim();
  session.state = STATE.CHECKOUT_ADDRESS;

  await sendText(
    env,
    to,
    `Thanks, *${session.checkout.name}* 💕\n\nPlease send your full delivery address (with pincode).`
  );
}

async function handleCheckoutAddress(env, to, session, address) {
  session.checkout.address = address.trim();
  session.state = STATE.ORDER_PLACED;

  const summary =
    "✅ *GlowCart Order Confirmed!*\n\n" +
    "👤 Name: " +
    session.checkout.name +
    "\n" +
    "📍 Address: " +
    session.checkout.address +
    "\n\n" +
    "🛍 Items:\n" +
    formatCart(session) +
    "\n\nOur team will contact you on WhatsApp for payment & shipping details.\n" +
    "Thank you for shopping with GlowCart ✨\n\n" +
    "Type *menu* to start a new order.";

  await sendText(env, to, summary);
}

/**
 * STEP 4: Sending messages via WhatsApp Cloud API
 */
async function sendText(env, to, body) {
  const url = `https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Error sending WhatsApp message:", res.status, text);
  }
}
