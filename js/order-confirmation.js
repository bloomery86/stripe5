document.addEventListener('DOMContentLoaded', async function() {
    // Get elements
    const orderNumberElement = document.getElementById('orderNumber');
    const deliveryDetailsElement = document.getElementById('deliveryDetails');
    const paymentDetailsElement = document.getElementById('paymentDetails');
    const orderedItemsElement = document.getElementById('orderedItems');
    const subtotalElement = document.querySelector('.subtotal');
    const shippingElement = document.querySelector('.shipping');
    const totalElement = document.querySelector('.total-amount');
    const printOrderBtn = document.querySelector('.print-order');

    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const orderNumber = urlParams.get('order_number');

    // Get order data from localStorage
    const orderData = JSON.parse(localStorage.getItem('orderData')) || {};

    // Display order number
    if (orderNumberElement) {
        orderNumberElement.textContent = orderNumber || 'N/A';
    }

    // Display delivery details
    if (deliveryDetailsElement && orderData.delivery) {
        deliveryDetailsElement.innerHTML = `
            <div class="detail-item">
                <div class="detail-label">Nume</div>
                <div class="detail-value">${orderData.delivery.firstName} ${orderData.delivery.lastName}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Email</div>
                <div class="detail-value">${orderData.delivery.email}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Telefon</div>
                <div class="detail-value">${orderData.delivery.phone}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Adresă</div>
                <div class="detail-value">${orderData.delivery.address}, ${orderData.delivery.county}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Metodă Livrare</div>
                <div class="detail-value">${orderData.delivery.deliveryMethod === 'pickup' ? 'Ridicare din Magazin' : 'Curier'}</div>
            </div>
        `;
    }

    // If we have a session ID, fetch the payment details
    if (sessionId) {
        try {
            const response = await fetch(`/.netlify/functions/get-session?session_id=${sessionId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch session details');
            }
            const sessionData = await response.json();
            
            // If payment is successful, send WhatsApp notification
            if (sessionData.payment_status === 'paid') {
                try {
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
                        `*Număr Comandă:* #${orderNumber}\n` +
                        `*Data:* ${new Date().toLocaleString('ro-RO')}\n\n` +
                        
                        `📦 *Detalii Livrare:*\n` +
                        `• Nume: ${orderData.delivery.firstName} ${orderData.delivery.lastName}\n` +
                        `• Telefon: ${orderData.delivery.phone}\n` +
                        `• Email: ${orderData.delivery.email}\n` +
                        `• Adresă: ${orderData.delivery.address}\n` +
                        `• Județ: ${orderData.delivery.county}\n` +
                        `• Metoda: ${orderData.delivery.deliveryMethod === 'pickup' ? 'Ridicare din Magazin' : 'Livrare Curier'}\n\n` +
                        
                        `💳 *Metoda de Plată:*\n` +
                        `Card Online (Plată Confirmată)\n\n` +
                        
                        `🛍️ *Produse Comandate:*\n${cartItemsList}\n\n` +
                        
                        `💰 *Sumar Comandă:*\n` +
                        `• Subtotal: ${subtotal} lei\n` +
                        `• Transport: ${shipping === 0 ? 'Gratuit' : shipping + ' lei'}\n` +
                        `• *TOTAL: ${total} lei*\n\n` +
                        
                        `✨ Mulțumim pentru comandă! ✨`;

                    // Send WhatsApp notification
                    const notificationResponse = await fetch('/.netlify/functions/send-whatsapp', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ message })
                    });

                    if (!notificationResponse.ok) {
                        throw new Error('Failed to send WhatsApp notification');
                    }

                    console.log('WhatsApp notification sent successfully');
                } catch (error) {
                    console.error('Error sending WhatsApp notification:', error);
                }
            }
            
            // Update payment status
            if (paymentDetailsElement) {
                paymentDetailsElement.innerHTML = `
                    <div class="detail-item">
                        <div class="detail-label">Metodă de Plată</div>
                        <div class="detail-value">Card</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Status Plată</div>
                        <div class="detail-value">${sessionData.payment_status === 'paid' ? 'Confirmată' : 'În așteptare'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Email Confirmare</div>
                        <div class="detail-value">${sessionData.customer_email}</div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error fetching session:', error);
        }
    } else {
        // Display payment details
        if (paymentDetailsElement && orderData.payment) {
            const paymentMethod = orderData.payment.method === 'cash' ? 'Plată la Livrare - Cash' : 'Plată la Livrare - Card';
            paymentDetailsElement.innerHTML = `
                <div class="detail-item">
                    <div class="detail-label">Metodă de Plată</div>
                    <div class="detail-value">${paymentMethod}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Status Plată</div>
                    <div class="detail-value">În așteptare</div>
                </div>
            `;
        }
    }

    // Display ordered items
    if (orderedItemsElement && orderData.cart) {
        let subtotal = 0;
        
        orderData.cart.forEach(item => {
            subtotal += item.price * item.quantity;
            
            const itemElement = document.createElement('div');
            itemElement.className = 'ordered-item';
            itemElement.innerHTML = `
                <div class="item-image">
                    <img src="${item.image}" alt="${item.name}">
                </div>
                <div class="item-details">
                    <div class="item-name">${item.name}</div>
                    <div class="item-price">${item.price} lei</div>
                    <div class="item-quantity">Cantitate: ${item.quantity}</div>
                </div>
                <div class="item-total">${item.price * item.quantity} lei</div>
            `;
            orderedItemsElement.appendChild(itemElement);
        });

        // Update summary
        const shipping = orderData.delivery.deliveryMethod === 'pickup' ? 0 : 15;
        const total = subtotal + shipping;

        subtotalElement.textContent = `${subtotal} lei`;
        shippingElement.textContent = shipping === 0 ? 'Gratuit' : `${shipping} lei`;
        totalElement.textContent = `${total} lei`;
    }

    // Handle print button
    if (printOrderBtn) {
        printOrderBtn.addEventListener('click', () => {
            window.print();
        });
    }

    // Clear cart and order data from localStorage
    localStorage.removeItem('cart');
    localStorage.removeItem('deliveryData');
    // Keep orderData for reference
});
