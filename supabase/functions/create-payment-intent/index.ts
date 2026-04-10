import Stripe from 'https://esm.sh/stripe@13.11.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  try {
    const { amount, currency = 'eur', type } = await req.json();

    console.log('Type reçu:', type, 'Montant:', amount);

    // Pour la carte (type 'card')
    if (type === 'card') {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency,
        payment_method_types: ['card'],
      });

      console.log('PaymentIntent créé:', paymentIntent.id);

      // Retourner client_secret
      return new Response(JSON.stringify({
        clientSecret: paymentIntent.client_secret
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      });
    }

    // Pour le QR code (type 'qr')
    else if (type === 'qr') {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency,
            product_data: {
              name: 'Achat en magasin'
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: 'https://stock-fr.pages.dev/caisse.html?payment_success=1',
        cancel_url: 'https://stock-fr.pages.dev/caisse.html?payment_cancel=1',
      });

      console.log('Session créée:', session.id, 'URL:', session.url);

      // Retourner l'URL de checkout
      return new Response(JSON.stringify({
        url: session.url
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      });
    }

    else {
      throw new Error('Type de paiement non supporté');
    }

  } catch (err) {
    console.error('Erreur:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    });
  }
});