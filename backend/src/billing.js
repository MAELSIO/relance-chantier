const Stripe = require('stripe');

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

async function createCheckoutSession({ user, priceId, successUrl, cancelUrl }) {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe non configure (STRIPE_SECRET_KEY manquant).');

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: user.stripe_customer_id ? undefined : user.email,
    customer: user.stripe_customer_id || undefined,
    client_reference_id: String(user.id),
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    payment_method_collection: 'if_required',
    metadata: { userId: String(user.id) }
  });
  return session;
}

function verifyWebhook(rawBody, signature) {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe non configure.');
  return stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}

module.exports = { getStripe, createCheckoutSession, verifyWebhook };
