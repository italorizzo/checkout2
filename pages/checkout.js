import { useEffect } from 'react';

export default function CheckoutPage() {
  useEffect(() => {
    const loadEmbeddedCheckout = async () => {
      const { loadStripe } = await import('@stripe/stripe-js');
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

      await new Promise(resolve => {
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/embedded/v1.js';
        script.onload = resolve;
        document.head.appendChild(script);
      });

      const urlParams = new URLSearchParams(window.location.search);
      const clientSecret = urlParams.get("clientSecret");

      if (clientSecret && stripe) {
        const checkout = stripe.initEmbeddedCheckout({ clientSecret });
        checkout.mount("#checkout");
      } else {
        console.error("clientSecret ausente ou Stripe não carregado");
      }
    };

    loadEmbeddedCheckout();
  }, []);

  return (
    <div style={{
      backgroundColor: "#f3cb75",
      minHeight: "100vh",
      padding: "40px",
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start"
    }}>
      <div
        id="checkout"
        style={{
          width: "100%",
          maxWidth: "600px",
          background: "white",
          padding: "32px",
          borderRadius: "16px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)"
        }}
      ></div>
    </div>
  );
}
