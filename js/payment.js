document.addEventListener('DOMContentLoaded', function() {
    // Get elements
    const cartItemsContainer = document.querySelector('.cart-items');
    const subtotalElement = document.querySelector('.subtotal');
    const shippingElement = document.querySelector('.shipping');
    const totalElement = document.querySelector('.total-amount');
    const confirmPaymentBtn = document.querySelector('.confirm-payment-btn');
    
    // Get cart and delivery data from localStorage
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const deliveryData = JSON.parse(localStorage.getItem('deliveryData')) || {};
    
    // Validate access to payment page
    function validateAccess() {
        // Check if cart is empty
        if (!cart || cart.length === 0) {
            alert('Coșul tău este gol. Vei fi redirecționat la pagina principală.');
            window.location.href = './index.html';
            return false;
        }

        // Check if delivery data is complete
        const requiredFields = ['firstName', 'lastName', 'email', 'phone', 'county', 'address'];
        const missingFields = requiredFields.filter(field => !deliveryData[field]);

        if (missingFields.length > 0) {
            alert('Te rugăm să completezi toate detaliile de livrare înainte de a continua.');
            window.location.href = './checkout.html';
            return false;
        }

        return true;
    }

    // Validate access when page loads
    if (!validateAccess()) {
        return;
    }
    
    // Render cart items
    function renderCartItems() {
        if (!cartItemsContainer) return;

        cartItemsContainer.innerHTML = '';
        let subtotal = 0;

        cart.forEach(item => {
            subtotal += item.price * item.quantity;
            
            const itemElement = document.createElement('div');
            itemElement.className = 'cart-item';
            itemElement.innerHTML = `
                <div class="item-details">
                    <h3>${item.name}</h3>
                    <p class="item-price">${item.price} lei × ${item.quantity}</p>
                </div>
                <div class="item-total">${item.price * item.quantity} lei</div>
            `;
            cartItemsContainer.appendChild(itemElement);
        });

        // Update summary
        updateOrderSummary(subtotal);
    }

    // Update order summary
    function updateOrderSummary(subtotal) {
        const shipping = deliveryData.deliveryMethod === 'pickup' ? 0 : 15;
        const total = subtotal + shipping;

        subtotalElement.textContent = `${subtotal} lei`;
        shippingElement.textContent = shipping === 0 ? 'Gratuit' : `${shipping} lei`;
        totalElement.textContent = `${total} lei`;
    }

    // Handle payment confirmation
    if (confirmPaymentBtn) {
        confirmPaymentBtn.addEventListener('click', async () => {
            const selectedPayment = document.querySelector('input[name="payment"]:checked').value;
            
            // Save order data
            const orderData = {
                orderNumber: generateOrderNumber(),
                cart: cart,
                delivery: deliveryData,
                payment: {
                    method: selectedPayment,
                    status: 'pending'
                },
                date: new Date().toISOString(),
                status: 'confirmed'
            };
            
            localStorage.setItem('orderData', JSON.stringify(orderData));
            
            // Prepare email template parameters
            const templateParams = {
                order_number: orderData.orderNumber,
                customer_name: `${orderData.delivery.firstName} ${orderData.delivery.lastName}`,
                customer_email: orderData.delivery.email,
                customer_phone: orderData.delivery.phone,
                delivery_address: `${orderData.delivery.address}, ${orderData.delivery.county}`,
                delivery_method: orderData.delivery.deliveryMethod === 'pickup' ? 'Ridicare din Magazin' : 'Curier',
                payment_method: orderData.payment.method === 'cash' ? 'Cash la Livrare' : 'Card la Livrare',
                order_items: cart.map(item => `${item.name} x ${item.quantity} = ${item.price * item.quantity} lei`).join('\n'),
                order_total: cart.reduce((total, item) => total + (item.price * item.quantity), 0) + 
                            (orderData.delivery.deliveryMethod === 'pickup' ? 0 : 15)
            };

            try {
                console.log('Sending email...');
                await emailjs.send(
                    "service_djhffdj", 
                    "template_elvd3c7", 
                    templateParams
                );
                console.log('Email sent successfully');

                // Format cart items for WhatsApp
                const cartItemsList = cart.map(item => 
                    `• ${item.name}\n   ${item.quantity} x ${item.price} lei = ${item.price * item.quantity} lei`
                ).join('\n');

                // Calculate totals
                const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
                const shipping = orderData.delivery.deliveryMethod === 'pickup' ? 0 : 15;
                const total = subtotal + shipping;

                // Create a nicely formatted WhatsApp message
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
                    
                    `💳 *Metoda de Plată:*\n` +
                    `${orderData.payment.method === 'cash' ? 'Cash la Livrare' : 'Card la Livrare'}\n\n` +
                    
                    `🛍️ *Produse Comandate:*\n${cartItemsList}\n\n` +
                    
                    `💰 *Sumar Comandă:*\n` +
                    `• Subtotal: ${subtotal} lei\n` +
                    `• Transport: ${shipping === 0 ? 'Gratuit' : shipping + ' lei'}\n` +
                    `• *TOTAL: ${total} lei*\n\n` +
                    
                    `✨ Mulțumim pentru comandă! ✨`;

                console.log('Sending WhatsApp message...');
                
                // Determine the API endpoint based on the environment
                const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                const apiEndpoint = isLocalhost 
                    ? 'http://localhost:8888/.netlify/functions/send-whatsapp'
                    : '/.netlify/functions/send-whatsapp';

                // Send WhatsApp notification through function
                try {
                    console.log('Sending request to WhatsApp function at:', apiEndpoint);
                    const response = await fetch(apiEndpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ message })
                    });

                    const responseData = await response.json();

                    if (!response.ok) {
                        throw new Error(`Failed to send WhatsApp notification: ${responseData.error || 'Unknown error'}`);
                    }

                    console.log('WhatsApp notification response:', responseData);
                } catch (error) {
                    console.error('Error sending WhatsApp notification:', error);
                    // Don't throw the error - we still want to redirect to confirmation
                }
                
                // Redirect to confirmation page
                window.location.href = './order-confirmation.html';
            } catch (error) {
                console.error('Error details:', error);
                // Continue to confirmation page anyway
                window.location.href = './order-confirmation.html';
            }
        });
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

    // Initialize the page
    renderCartItems();
});
