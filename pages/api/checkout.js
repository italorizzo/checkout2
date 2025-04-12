import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://petzycompany.store');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { cartItems, customerEmail } = req.body;

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: 'Itens do carrinho estão ausentes ou inválidos' });
    }

    // Soma total dos produtos
    const totalCartAmount = cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // Cálculo do frete progressivo
    let shippingAmount = 0;
    let shippingLabel = '';

    if (totalCartAmount >= 50) {
      shippingAmount = 0;
      shippingLabel = 'Free Shipping';
    } else {
      const baseShipping = 9.90;
      const discount = Math.floor(totalCartAmount / 10);
      shippingAmount = Math.max(0, Math.min(baseShipping - discount, 15));
      shippingLabel = 'Shipping (Free over $50)';
    }

    // Produtos formatados para Stripe
    const lineItems = cartItems.map((item) => ({
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(item.price * 100),
        product_data: {
          name: item.title,
          images: item.image ? [item.image] : [],
          metadata: {
            sku: item.sku || '',
          },
        },
      },
      quantity: item.quantity,
    }));

    // Log dos produtos
    console.log('🧩 Produtos com SKU:');
    cartItems.forEach((item) => {
      console.log(`• ${item.title} | SKU: ${item.sku || '(sem SKU)'} | Qtd: ${item.quantity} | $${item.price}`);
    });

    // Adiciona frete como item
    lineItems.push({
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(shippingAmount * 100),
        product_data: {
          name: shippingLabel,
        },
      },
      quantity: 1,
    });

    const sessionParams = {
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      metadata: {
        cart: JSON.stringify(cartItems),
        shipping_label: shippingLabel,
      },
      success_url: 'https://petzycompany.store/pages/thank-you-for-your-purchase',
      cancel_url: 'https://petzycompany.store/cart',
    };

    if (customerEmail) {
      sessionParams.customer_email = customerEmail;
    }

    console.log('📦 Checkout Stripe Session Params:\n', JSON.stringify(sessionParams, null, 2));

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('❌ Erro ao criar sessão de checkout:', err);
    return res.status(500).json({ error: err.message });
  }
}
