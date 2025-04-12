import { buffer } from 'micro';
import Stripe from 'stripe';
import fetch from 'node-fetch';

export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  let event;

  try {
    const sig = req.headers['stripe-signature'];
    const buf = await buffer(req);

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('❌ STRIPE_WEBHOOK_SECRET está ausente no ambiente');
      return res.status(500).send('Webhook configuration error.');
    }

    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Erro ao validar webhook:', err.message);
    return res.status(401).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = await stripe.checkout.sessions.retrieve(event.data.object.id, {
      expand: ['line_items', 'customer_details', 'shipping'],
    });

    try {
      const cartItems = JSON.parse(session.metadata?.cart || '[]');
      const shopifyDomain = 'zdmmqb-9d.myshopify.com';
      const apiVersion = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

      const line_items = await Promise.all(cartItems.map(async (item) => {
        let variantId = item.variant_id;

        if (!variantId && item.sku) {
          const productRes = await fetch(`https://${shopifyDomain}/admin/api/${apiVersion}/variants.json?sku=${item.sku}`, {
            headers: {
              'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN,
              'Content-Type': 'application/json'
            }
          });
          const variantData = await productRes.json();
          variantId = variantData.variants?.[0]?.id;
        }

        if (variantId) {
          return {
            quantity: item.quantity,
            variant_id: variantId,
          };
        } else {
          return {
            name: item.title,
            title: item.title,
            price: item.price,
            quantity: item.quantity,
          };
        }
      }));

      const totalProducts = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

      let shippingAmount = 0;
      let shippingLabel = '';

      if (totalProducts >= 50) {
        shippingAmount = 0;
        shippingLabel = 'Free Shipping';
      } else {
        const baseShipping = 9.90;
        const discount = Math.floor(totalProducts / 10);
        shippingAmount = Math.max(0, Math.min(baseShipping - discount, 15));
        shippingLabel = 'Shipping';
      }

      const shipping_lines = [
        {
          title: shippingLabel,
          price: shippingAmount,
          price_set: {
            shop_money: {
              amount: shippingAmount,
              currency_code: 'USD',
            },
            presentment_money: {
              amount: shippingAmount,
              currency_code: 'USD',
            },
          },
        },
      ];

      const rawAddress = session.shipping?.address || session.customer_details?.address;

      const shipping_address = rawAddress
        ? {
            address1: rawAddress.line1,
            address2: rawAddress.line2 || '',
            city: rawAddress.city,
            province: rawAddress.state,
            country: rawAddress.country,
            zip: rawAddress.postal_code,
            name: session.customer_details?.name || '',
            phone: session.customer_details?.phone || '',
          }
        : null;

      const shopifyOrderPayload = {
        order: {
          email: session.customer_details?.email || session.customer_email || 'nao@informado.com',
          financial_status: 'paid',
          line_items,
          shipping_lines,
          ...(shipping_address && { shipping_address }),
        },
      };

      const shopifyResponse = await fetch(
        `https://${shopifyDomain}/admin/api/${apiVersion}/orders.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN,
          },
          body: JSON.stringify(shopifyOrderPayload),
        }
      );

      const shopifyData = await shopifyResponse.json();

      if (!shopifyResponse.ok) {
        console.error('❌ Shopify API error:', shopifyData);
        return res.status(500).json({ error: shopifyData });
      }

      console.log('✅ Pedido criado na Shopify:', shopifyData.order?.id);
      return res.status(200).json({ success: true, shopifyData });
    } catch (err) {
      console.error('❌ Erro ao criar pedido na Shopify:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(200).json({ received: true });
}
