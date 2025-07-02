interface WebhookResponse {
  analysis: string;
}

export const sendToWebhook = async (notes: string): Promise<WebhookResponse> => {
  try {
    const response = await fetch('http://localhost:5678/webhook-test/53ca8fcf-d87f-4742-90cc-5fb9755fcee8', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notes: notes
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Webhook response:', data); // Debug log

    // If the response is a string directly
    if (typeof data === 'string') {
      return { analysis: data };
    }

    // If the response is in a 'data' property (common n8n format)
    if (data.data) {
      return { analysis: data.data };
    }

    // If the response is in a specific property
    const possibleFields = ['output', 'result', 'response', 'message', 'analysis'];
    for (const field of possibleFields) {
      if (data[field]) {
        return { analysis: data[field] };
      }
    }

    // If we can't find the data in any expected field, return the whole response
    return {
      analysis: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Error sending data to webhook:', error);
    throw new Error('Unable to connect to the webhook. Please check if n8n is running.');
  }
}; 