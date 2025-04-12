const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(req.query.session_id, {
      expand: ['line_items', 'customer_details'],
    });

    res.status(200).json({
      status: session.status,
      email: session.customer_details?.email,
      name: session.customer_details?.name,
      address: session.customer_details?.address,
      products: session.line_items?.data.map((item) => ({
        title: item.description,
        quantity: item.quantity,
        amount_total: item.amount_total / 100,
      })),
    });
  } catch (error) {
    console.error('Erro ao buscar sessão:', error);
    res.status(400).json({ error: 'Invalid session_id or session not found' });
  }
}
