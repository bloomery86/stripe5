import fetch from 'node-fetch';

export const handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get the message from the request body
    const { message } = JSON.parse(event.body);

    if (!message) {
      throw new Error('Message is required');
    }

    // WhatsApp credentials from environment variables
    const whatsappPhone = process.env.WHATSAPP_PHONE;
    const whatsappApiKey = process.env.WHATSAPP_API_KEY;

    if (!whatsappPhone || !whatsappApiKey) {
      throw new Error('WhatsApp credentials not configured');
    }

    // Construct the WhatsApp API URL
    const whatsappUrl = `https://api.callmebot.com/whatsapp.php?phone=${whatsappPhone}&text=${encodeURIComponent(message)}&apikey=${whatsappApiKey}`;

    // Send the WhatsApp message
    const response = await fetch(whatsappUrl);
    const responseText = await response.text();
    
    if (!response.ok) {
      throw new Error(`Failed to send WhatsApp message: ${responseText}`);
    }

    console.log('WhatsApp API response:', responseText);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Allow requests from any origin
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ 
        message: 'WhatsApp notification sent successfully',
        response: responseText 
      })
    };
  } catch (error) {
    console.error('Error sending WhatsApp notification:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Allow requests from any origin
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};
