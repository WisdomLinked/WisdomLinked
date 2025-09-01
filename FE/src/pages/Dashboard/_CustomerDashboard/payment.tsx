import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
    PaymentElement,
    Elements,
    useStripe,
    useElements,
} from '@stripe/react-stripe-js';
import { createStripePaymentIntent, getStripeMode, appendPaymentHistoryByCustomer } from '../../../api/api';
import ShowFieldError from '../../../components/ShowFieldError';
import { SetLoadingStatus } from '../../../actions/appActions';

const CheckoutForm = ({
    pendingDetails,
    stripeMode,
    price
}: any) => {
    const stripe: any = useStripe();
    const elements = useElements();

    // const [errorMessage, set_errorMessage] = useState<any>(null);
    const [errorMessage, set_errorMessage] = useState<string>("");

    function checkStorageUsage() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += (localStorage[key].length + key.length) * 2; // Estimate size in bytes
            }
        }
        console.log(`Approximate localStorage usage: ${total} bytes`);
        return total;
    }

    // const handleSubmit = async (event: any) => {
    //     try {
    //         event.preventDefault();
    //         if (elements == null) {
    //             return;
    //         }
    //
    //         // Trigger form validation and wallet collection
    //         const { error: submitError }: any = await elements.submit();
    //         if (submitError) {
    //             // Show error to your customer
    //             set_errorMessage(submitError.message);
    //             SetLoadingStatus(false)
    //             return;
    //         }
    //
    //         SetLoadingStatus(true)
    //         // Create the PaymentIntent and obtain clientSecret from your server endpoint
    //         const response = await createStripePaymentIntent({
    //             stripeMode,
    //             amount: price,
    //         })
    //         const { client_secret: clientSecret } = response;
    //
    //         console.log("pending details", pendingDetails);
    //         console.log("pending details len", );
    //
    //         checkStorageUsage();
    //
    //         window.localStorage.setItem('pendingDetails', JSON.stringify(pendingDetails))
    //         const { paymentIntent } = await stripe.confirmPayment({
    //             //`Elements` instance that was used to create the Payment Element
    //             elements,
    //             clientSecret,
    //             confirmParams: {
    //                 return_url: `${window.location.href}`,
    //             },
    //             redirect: "if_required"
    //         });
    //         SetLoadingStatus(false)
    //
    //         if (paymentIntent.status === 'succeeded') {
    //             window.location.replace(`${window.location.href.split('?')[0]}?redirect_status=succeeded&payment_intent=${paymentIntent.id}`)
    //         } else {
    //             window.localStorage.removeItem('pendingDetails')
    //             set_errorMessage('Payment failed, try again');
    //         }
    //
    //     } catch (error: any) {
    //         set_errorMessage(error.message);
    //         SetLoadingStatus(false)
    //     }
    // };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!stripe || !elements) {
            return;
        }

        try {
            if (price === 0) {
                // Directly mark the payment as successful
                window.localStorage.setItem('pendingDetails', JSON.stringify(pendingDetails));
                window.location.replace(`${window.location.href.split('?')[0]}?redirect_status=succeeded&payment_intent=0`);
                return;
            }

            // Force validation
            const { error: submitError }: any = await elements.submit();
            if (submitError) {
                set_errorMessage(submitError.message);
                SetLoadingStatus(false);
                return;
            }

            SetLoadingStatus(true);

            // Always create a PaymentIntent, even if amount=0
            const response = await createStripePaymentIntent({
                stripeMode,
                amount: price, // Possibly 0
            });
            const { client_secret: clientSecret } = response;
            if (!clientSecret) {
                SetLoadingStatus(false);
                set_errorMessage("Could not start payment. Please try again.");
                console.error("[createStripePaymentIntent] No client_secret:", response);
                return;
            }
            checkStorageUsage();
            window.localStorage.setItem('pendingDetails', JSON.stringify(pendingDetails));

            const { paymentIntent } = await stripe.confirmPayment({
                elements,
                clientSecret,
                confirmParams: {
                    return_url: window.location.href, // user is redirected back
                },
                redirect: "if_required"
            });

            SetLoadingStatus(false);

            if (paymentIntent?.status === 'succeeded') {
                try {
                  await appendPaymentHistoryByCustomer({
                    stripeMode,
                    amountUSD: price, // what we actually charged
                    description: pendingDetails ? (pendingDetails?.type || 'Payment') : 'Ad-hoc payment',
                    paymentIntent: paymentIntent.id,
                  });
                } catch (e) {
                  console.warn('[appendPaymentHistoryByCustomer] failed', e);
                }
                window.location.replace(
                  `${window.location.href.split('?')[0]}?redirect_status=succeeded&payment_intent=${paymentIntent.id}`
                );
              } else {
                window.localStorage.removeItem('pendingDetails');
                set_errorMessage('Payment failed, try again.');
              }
              
        } catch (err: any) {
            console.error("Error during handleSubmit", err);
            set_errorMessage(err.message || "Error while processing payment.");
            SetLoadingStatus(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            set_errorMessage('')
        }, 4000)
        return () => {
            clearTimeout(timer)
        }
    }, [errorMessage])

    return (
        <form onSubmit={handleSubmit}>
            <PaymentElement />
            {/*<ShowFieldError*/}
            {/*    show={errorMessage}*/}
            {/*    label={errorMessage}*/}
            {/*/>*/}
            <ShowFieldError show={!!errorMessage} label={errorMessage} />
            <button
                type="submit"
                disabled={!stripe || !elements}
                className='w-[100px] h-[40px] bg-green rounded-md text-white text-lg mt-4 disabled:hidden mx-auto flex items-center justify-center'
            >
                Pay
            </button>

        </form>
    );
};

const Payment = ({
    type,
    price,
    pendingDetails
}: any) => {

    const options: any = {
        mode: 'payment',
        // amount: price * 1000,
        amount: price > 0 ? Math.round(price * 100) : 1,
        currency: 'usd',
        // Fully customizable with appearance API.
        appearance: {
            theme: 'night',
        },
    };

    const [stripeMode, set_stripeMode] = useState('')
    const [stripePromise, set_stripePromise] = useState<any>(null)

    // const setStripeMode = async () => {
    //     const response = await getStripeMode()
    //     if (response) {
    //         set_stripeMode(response.stripeMode || 'test')
    //         set_stripePromise(loadStripe((response.stripeMode === 'test' ? process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY_TEST : process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY_LIVE) || ''))
    //     }
    // }
    const setStripeMode = async () => {
        try {
            // First, try to get from URL
            const urlParams = new URLSearchParams(window.location.search);
            const modeFromUrl = urlParams.get('mode');
            
            let finalMode = 'test'; // default fallback
            
            if (modeFromUrl === 'test' || modeFromUrl === 'live') {
                finalMode = modeFromUrl;
            } else {
                // Try server call
                const response = await getStripeMode();
                if (response && (response.stripeMode === 'test' || response.stripeMode === 'live')) {
                    finalMode = response.stripeMode;
                }
            }
            
            set_stripeMode(finalMode);
            
            const publishableKey = finalMode === 'test' 
                ? process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY_TEST 
                : process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY_LIVE;
                
            if (publishableKey) {
                const stripeInstance = loadStripe(publishableKey);
                set_stripePromise(stripeInstance);
                console.log('Stripe initialized with mode:', finalMode);
            } else {
                console.error('Missing Stripe publishable key for mode:', finalMode);
            }
        } catch (error) {
            console.error('Error setting up Stripe:', error);
            // Set default
            set_stripeMode('test');
            set_stripePromise(loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY_TEST || ''));
        }
    }

    useEffect(() => {
        // If URL has ?mode=test|live, prefer that. Otherwise, hit the server.
        const params = new URLSearchParams(window.location.search);
        const qMode = params.get('mode');
        console.log("[mode effect] qMode =", qMode);
      
        if (qMode === 'test' || qMode === 'live') {
          set_stripeMode(qMode);
      
          const pk = qMode === 'test'
            ? (process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY_TEST || '')
            : (process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY_LIVE || '');
            console.log("[Stripe PK prefix]", pk.slice(0, 10)); 
            
            const p = loadStripe(pk);
            set_stripePromise(p);
            p.then((stripe) => {
                console.log("[loadStripe resolved]", !!stripe);
              });
        } else {
          // your existing function that fetches mode + sets stripePromise
          console.log("I shouldnt be logged")
          setStripeMode();
        }
    }, []);
      
      


    useEffect(() => {
        console.log("[Stripe init]", { stripeMode, stripePromise: !!stripePromise });
        if (stripeMode && stripePromise) {
            SetLoadingStatus(false)
        } else {
            SetLoadingStatus(true)
        }
    }, [stripeMode, stripePromise])
    
    useEffect(() => {
        console.log('Stripe mode changed:', stripeMode);
        console.log('Stripe promise:', stripePromise);
    }, [stripeMode, stripePromise]);
      

    return (
        stripeMode && stripePromise ?
            <Elements stripe={stripePromise} options={options}>
                <div className='text-xl text-white text-center mb-6'>
                    Please pay ${price} for the {type} ({stripeMode})
                </div>
                <div style={{ opacity: 0.7, fontSize: 12, textAlign: 'center' }}>[Payment Element Mounting]</div>
                <div style={{ position: 'relative', zIndex: 10 }}>
                    <PaymentElement />
                </div>
                <CheckoutForm
                    pendingDetails={pendingDetails}
                    stripeMode={stripeMode}
                    price={price}
                />
            </Elements> :
            null
    )
}

export default Payment;