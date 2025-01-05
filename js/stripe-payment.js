// Initialize Stripe with your publishable key
const stripe = Stripe('pk_live_51QbjqNHQhH44e6Y1Supd4dDsVjcrvvfN3yDxQNZxBXU6oIbcCsTj323KERvwspgIX2wmoub5MKniH2GGvmBl98SW00o36GYe09');

document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the checkout page
    if (!window.location.pathname.includes('checkout.html')) {
        return; // Exit if not on checkout page
    }

    const checkoutForm = document.getElementById('checkoutForm');
    if (!checkoutForm) {
        console.error('Checkout form not found');
        return;
    }

    checkoutForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        try {
            console.log('Starting checkout process...');
            const items = getCartItems();
            console.log('Cart items:', items);

            if (items.length === 0) {
                throw new Error('Coșul este gol. Adăugați produse pentru a continua.');
            }

            // Get delivery data from localStorage (saved by checkout.js)
            const deliveryData = JSON.parse(localStorage.getItem('deliveryData'));
            if (!deliveryData) {
                throw new Error('Datele de livrare lipsesc. Vă rugăm completați formularul de livrare.');
            }

            // Validate required fields
            const requiredFields = ['firstName', 'lastName', 'email', 'phone', 'county'];
            const missingFields = requiredFields.filter(field => !deliveryData[field]);
            if (missingFields.length > 0) {
                throw new Error(`Vă rugăm completați toate câmpurile obligatorii: ${missingFields.join(', ')}`);
            }

            // If delivery method is courier, address is required
            if (deliveryData.deliveryMethod === 'courier' && !deliveryData.address) {
                throw new Error('Adresa este obligatorie pentru livrare prin curier.');
            }

            // Create order data
            const orderData = {
                orderNumber: generateOrderNumber(),
                cart: items,
                delivery: deliveryData,
                payment: {
                    method: 'card',
                    status: 'pending'
                },
                date: new Date().toISOString(),
                status: 'pending'
            };

            console.log('Order data:', orderData);

            // Save order data to localStorage
            localStorage.setItem('orderData', JSON.stringify(orderData));

            // Show loading state
            const submitButton = checkoutForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Se procesează...';

            // Determine if we're in development or production
            const isLocalDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            
            // Create Stripe checkout session
            const response = await fetch('/.netlify/functions/create-checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    items: items,
                    customerEmail: deliveryData.email,
                    orderData: orderData,
                    orderNumber: orderData.orderNumber
                }),
            });

            let errorMessage = '';
            if (!response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const errorData = await response.json();
                    errorMessage = errorData.error || 'Unknown server error';
                } else {
                    const errorText = await response.text();
                    console.error('Server response:', response.status, errorText);
                    errorMessage = `Server error: ${response.status} - ${errorText}`;
                }
                throw new Error(errorMessage);
            }

            let sessionData;
            try {
                sessionData = await response.json();
            } catch (error) {
                console.error('JSON parsing error:', error);
                throw new Error('Invalid response from server');
            }

            if (!sessionData || !sessionData.url) {
                throw new Error('Invalid session data received from server');
            }

            console.log('Stripe session created:', sessionData);

            // Store order number in sessionStorage for retrieval after payment
            sessionStorage.setItem('currentOrderNumber', orderData.orderNumber);

            // Redirect to Stripe Checkout
            window.location.href = sessionData.url;

        } catch (error) {
            console.error('Checkout error:', error);
            
            // Reset button state
            const submitButton = checkoutForm.querySelector('button[type="submit"]');
            submitButton.disabled = false;
            submitButton.textContent = 'Finalizează Comanda';

            // Show error to user
            alert(`A apărut o eroare: ${error.message}`);
        }
    });
});

// Helper function to get cart items
function getCartItems() {
    const cartItems = JSON.parse(localStorage.getItem('cart')) || [];
    return cartItems.map(item => ({
        id: item.id,
        name: item.name,
        price: parseFloat(item.price.toString().replace(/[^\d.,]/g, '').replace(',', '.')),
        quantity: item.quantity,
        image: item.image
    }));
}

// Generate unique order number
function generateOrderNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD-${year}${month}${day}-${random}`;
}

async function sendNotifications(orderData) {
    try {
        // Prepare email template parameters
        const templateParams = {
            order_number: orderData.orderNumber,
            customer_name: `${orderData.delivery.firstName} ${orderData.delivery.lastName}`,
            customer_email: orderData.delivery.email,
            customer_phone: orderData.delivery.phone,
            delivery_address: `${orderData.delivery.address}, ${orderData.delivery.county}`,
            delivery_method: orderData.delivery.deliveryMethod === 'pickup' ? 'Ridicare din Magazin' : 'Curier',
            payment_method: 'Card Online',
            order_items: orderData.cart.map(item => `${item.name} x ${item.quantity} = ${item.price * item.quantity} lei`).join('\n'),
            order_total: orderData.cart.reduce((total, item) => total + (item.price * item.quantity), 0) + 
                        (orderData.delivery.deliveryMethod === 'pickup' ? 0 : 15)
        };

        console.log('Sending email...');
        await emailjs.send("service_djhffdj", "template_elvd3c7", templateParams);
        console.log('Email sent successfully');

        // Format cart items for WhatsApp
        const cartItemsList = orderData.cart.map(item => 
            `• ${item.name}\n   ${item.quantity} x ${item.price} lei = ${item.price * item.quantity} lei`
        ).join('\n');

        // Calculate totals
        const subtotal = orderData.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
        const shipping = orderData.delivery.deliveryMethod === 'pickup' ? 0 : 15;
        const total = subtotal + shipping;

        // Create WhatsApp message
        const message = `🌸 *Comandă Nouă Bloomery* 🌸\n\n` +
            `*Număr Comandă:* #${orderData.orderNumber}\n` +
            `*Data:* ${new Date().toLocaleString('ro-RO')}\n\n` +
            
            `📦 *Detalii Livrare:*\n` +
            `• Nume: ${orderData.delivery.firstName} ${orderData.delivery.lastName}\n` +
            `• Telefon: ${orderData.delivery.phone}\n` +
            `• Email: ${orderData.delivery.email}\n` +
            `• Adresă: ${orderData.delivery.address}\n` +
            `• Județ: ${orderData.delivery.county}\n` +
            `• Metoda: ${orderData.delivery.deliveryMethod === 'pickup' ? 'Ridicare din Magazin' : 'Livrare Curier'}\n\n` +
            
            `💳 *Metoda de Plată:* Card Online\n\n` +
            
            `🛍️ *Produse Comandate:*\n${cartItemsList}\n\n` +
            
            `💰 *Sumar Comandă:*\n` +
            `• Subtotal: ${subtotal} lei\n` +
            `• Transport: ${shipping === 0 ? 'Gratuit' : shipping + ' lei'}\n` +
            `• *TOTAL: ${total} lei*\n\n` +
            
            `✨ Mulțumim pentru comandă! ✨`;

        console.log('Sending WhatsApp message...');
        const phoneNumber = "40768076868";
        const apiKey = "9728672";
        const whatsappUrl = `https://api.callmebot.com/whatsapp.php?phone=${phoneNumber}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;
        
        const img = new Image();
        img.src = whatsappUrl;
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
        console.error('Error sending notifications:', error);
    }
}
