# Payment Gateway Webhook Documentation

## Overview

This payment gateway sends webhook notifications to client callback URLs at two key points in the payment process:

1. **Payment Initiation** - When STK push is sent to customer's phone
2. **Payment Completion** - When final payment status is received from Safaricom

## Webhook Flow

```
Client Request → Gateway → STK Push → Safaricom → Customer → Payment Result → Gateway → Client Webhook
     ↓                        ↓                                           ↓
   Webhook 1              Webhook 2                                 Final Status
   (initiated)            (completed/failed)
```

## Webhook Types

### 1. Payment Initiation Webhook (`payment.initiated`)

**Triggered:** Immediately after successful STK push to Safaricom

**Example Payload:**
```json
{
  "event": "payment.initiated",
  "timestamp": "2025-09-22T10:15:30.000Z",
  "data": {
    "orderId": "ORDER_123",
    "status": "pending",
    "amount": 100,
    "phoneNumber": "254743770216",
    "bankName": "Equity Bank",
    "accountReference": "ACC123",
    "eventType": "payment_initiated",
    "stkPushSent": true,
    "responseCode": "0",
    "responseDescription": "Success. Request accepted for processing",
    "customerMessage": "Enter your PIN on your phone to complete payment",
    "initiatedAt": "2025-09-22T10:15:30.000Z",
    "createdAt": "2025-09-22T10:15:00.000Z",
    "updatedAt": "2025-09-22T10:15:30.000Z"
  }
}
```

### 2. Payment Completion Webhook (`payment.completed` or `payment.failed`)

**Triggered:** When Safaricom sends payment result callback

**Success Example:**
```json
{
  "event": "payment.completed",
  "timestamp": "2025-09-22T10:16:45.000Z",
  "data": {
    "orderId": "ORDER_123",
    "status": "completed",
    "amount": 100,
    "phoneNumber": "254743770216",
    "bankName": "Equity Bank",
    "accountReference": "ACC123",
    "mpesaReceiptNumber": "TIM6U59GL8",
    "transactionDate": "20250922101645",
    "resultCode": "0",
    "resultDescription": "The service request is processed successfully",
    "eventType": "payment_callback_received",
    "callbackReceived": true,
    "finalStatus": "completed",
    "safaricomResultCode": "0",
    "safaricomResultDesc": "The service request is processed successfully",
    "processedAt": "2025-09-22T10:16:45.000Z",
    "createdAt": "2025-09-22T10:15:00.000Z",
    "updatedAt": "2025-09-22T10:16:45.000Z"
  }
}
```

**Failure Example:**
```json
{
  "event": "payment.failed",
  "timestamp": "2025-09-22T10:16:45.000Z",
  "data": {
    "orderId": "ORDER_123",
    "status": "failed",
    "amount": 100,
    "phoneNumber": "254743770216",
    "bankName": "Equity Bank",
    "accountReference": "ACC123",
    "resultCode": "1032",
    "resultDescription": "Request Cancelled by user",
    "eventType": "payment_callback_received",
    "callbackReceived": true,
    "finalStatus": "failed",
    "safaricomResultCode": "1032",
    "safaricomResultDesc": "Request Cancelled by user",
    "processedAt": "2025-09-22T10:16:45.000Z",
    "createdAt": "2025-09-22T10:15:00.000Z",
    "updatedAt": "2025-09-22T10:16:45.000Z"
  }
}
```

## Webhook Headers

Every webhook request includes these headers:

```http
Content-Type: application/json
User-Agent: PaymentGateway-Webhook/1.0
X-Webhook-Signature: sha256=a7b2c3d4e5f6...
X-Webhook-Event: payment.initiated
X-Webhook-Delivery: ORDER_123_1727000930000
X-Webhook-Timestamp: 2025-09-22T10:15:30.000Z
```

### Header Descriptions

- **`X-Webhook-Signature`**: HMAC-SHA256 signature for verification
- **`X-Webhook-Event`**: Event type (payment.initiated, payment.completed, payment.failed)
- **`X-Webhook-Delivery`**: Unique delivery ID (orderId_timestamp)
- **`X-Webhook-Timestamp`**: When the webhook was sent

## Webhook Security & Verification

### 1. Signature Verification

**Algorithm:** HMAC-SHA256  
**Secret:** Shared webhook secret (WEBHOOK_SECRET)  
**Payload:** Raw JSON request body

### 2. Verification Process

#### Step 1: Extract Signature
```javascript
const receivedSignature = req.headers['x-webhook-signature'];
// Expected format: "sha256=a7b2c3d4e5f6..."
```

#### Step 2: Generate Expected Signature
```javascript
const crypto = require('crypto');

const webhookSecret = 'your-webhook-secret-key';
const payload = JSON.stringify(req.body);

const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');
```

#### Step 3: Compare Signatures
```javascript
const isValid = receivedSignature === expectedSignature;
```

### 3. Complete Verification Example

```javascript
const crypto = require('crypto');
const express = require('express');

const app = express();

// Webhook secret (store securely)
const WEBHOOK_SECRET = 'wh_sec_7K9mP2nQ8xR5vL1jF4cE6tY3uI0oA9sD2gH7bN6mK1qW5eR8tY4uI7oP3aS6dF9gH2jK5lQ8xR1vB4nM7cV0zX3';

function verifyWebhookSignature(payload, signature) {
    const expectedSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');
    
    return signature === expectedSignature;
}

app.post('/webhook', express.raw({type: 'application/json'}), (req, res) => {
    const signature = req.headers['x-webhook-signature'];
    const payload = req.body.toString();
    
    // Verify signature
    if (!verifyWebhookSignature(payload, signature)) {
        console.error('❌ Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
    }
    
    console.log('✅ Webhook signature verified');
    
    // Parse the JSON payload
    const webhookData = JSON.parse(payload);
    
    // Process the webhook
    handleWebhook(webhookData);
    
    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ success: true });
});

function handleWebhook(data) {
    const { event, timestamp, data: paymentData } = data;
    
    switch (event) {
        case 'payment.initiated':
            console.log(`💳 Payment initiated for order ${paymentData.orderId}`);
            // Update your database - payment is pending
            updateOrderStatus(paymentData.orderId, 'pending');
            break;
            
        case 'payment.completed':
            console.log(`✅ Payment completed for order ${paymentData.orderId}`);
            console.log(`📄 Receipt: ${paymentData.mpesaReceiptNumber}`);
            // Update your database - payment successful
            updateOrderStatus(paymentData.orderId, 'paid');
            fulfillOrder(paymentData.orderId);
            break;
            
        case 'payment.failed':
            console.log(`❌ Payment failed for order ${paymentData.orderId}`);
            console.log(`💬 Reason: ${paymentData.resultDescription}`);
            // Update your database - payment failed
            updateOrderStatus(paymentData.orderId, 'failed');
            break;
            
        default:
            console.log(`🤷 Unknown webhook event: ${event}`);
    }
}
```

## Python Verification Example

```python
import hmac
import hashlib
import json
from flask import Flask, request

app = Flask(__name__)

WEBHOOK_SECRET = 'wh_sec_7K9mP2nQ8xR5vL1jF4cE6tY3uI0oA9sD2gH7bN6mK1qW5eR8tY4uI7oP3aS6dF9gH2jK5lQ8xR1vB4nM7cV0zX3'

def verify_webhook_signature(payload, signature):
    expected_signature = hmac.new(
        WEBHOOK_SECRET.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    return signature == expected_signature

@app.route('/webhook', methods=['POST'])
def handle_webhook():
    signature = request.headers.get('X-Webhook-Signature')
    payload = request.get_data()
    
    # Verify signature
    if not verify_webhook_signature(payload, signature):
        return {'error': 'Invalid signature'}, 401
    
    # Parse webhook data
    webhook_data = json.loads(payload)
    
    # Process webhook
    event = webhook_data['event']
    payment_data = webhook_data['data']
    
    if event == 'payment.initiated':
        print(f"💳 Payment initiated for order {payment_data['orderId']}")
        # Update order status to pending
        
    elif event == 'payment.completed':
        print(f"✅ Payment completed for order {payment_data['orderId']}")
        print(f"📄 Receipt: {payment_data['mpesaReceiptNumber']}")
        # Update order status to paid and fulfill order
        
    elif event == 'payment.failed':
        print(f"❌ Payment failed for order {payment_data['orderId']}")
        # Update order status to failed
    
    return {'success': True}
```

## PHP Verification Example

```php
<?php
function verifyWebhookSignature($payload, $signature) {
    $webhookSecret = 'wh_sec_7K9mP2nQ8xR5vL1jF4cE6tY3uI0oA9sD2gH7bN6mK1qW5eR8tY4uI7oP3aS6dF9gH2jK5lQ8xR1vB4nM7cV0zX3';
    $expectedSignature = hash_hmac('sha256', $payload, $webhookSecret);
    
    return $signature === $expectedSignature;
}

// Get webhook data
$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? '';

// Verify signature
if (!verifyWebhookSignature($payload, $signature)) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid signature']);
    exit;
}

// Parse webhook data
$webhookData = json_decode($payload, true);
$event = $webhookData['event'];
$paymentData = $webhookData['data'];

// Process webhook
switch ($event) {
    case 'payment.initiated':
        error_log("💳 Payment initiated for order " . $paymentData['orderId']);
        // Update order status to pending
        break;
        
    case 'payment.completed':
        error_log("✅ Payment completed for order " . $paymentData['orderId']);
        error_log("📄 Receipt: " . $paymentData['mpesaReceiptNumber']);
        // Update order status to paid and fulfill order
        break;
        
    case 'payment.failed':
        error_log("❌ Payment failed for order " . $paymentData['orderId']);
        // Update order status to failed
        break;
}

// Always respond with 200
http_response_code(200);
echo json_encode(['success' => true]);
?>
```

## Best Practices

### 1. Webhook Endpoint Security
- ✅ Always verify webhook signatures
- ✅ Use HTTPS for webhook URLs
- ✅ Implement rate limiting
- ✅ Log all webhook events
- ✅ Return 200 status for successful processing
- ❌ Don't expose sensitive data in logs

### 2. Idempotency
- Handle duplicate webhooks gracefully
- Use order ID to check if already processed
- Store webhook delivery IDs to detect duplicates

```javascript
// Example idempotency check
const processedWebhooks = new Set();

app.post('/webhook', (req, res) => {
    const deliveryId = req.headers['x-webhook-delivery'];
    
    if (processedWebhooks.has(deliveryId)) {
        console.log('Duplicate webhook detected, ignoring');
        return res.status(200).json({ success: true });
    }
    
    // Process webhook
    handleWebhook(req.body);
    
    // Mark as processed
    processedWebhooks.add(deliveryId);
    
    res.status(200).json({ success: true });
});
```

### 3. Error Handling
- Return appropriate HTTP status codes
- Log errors for debugging
- Implement retry logic if needed

### 4. Webhook Testing
Use the test endpoints for development:

```bash
# Simple test endpoint (basic connectivity test)
curl -X POST http://localhost:4001/api/v1/test-callback-sending/test \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Create test transaction
curl -X POST http://localhost:4001/api/v1/test-callback-sending/create-test-transaction \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "TEST_123",
    "callbackUrl": "https://your-domain.com/webhook"
  }'

# Send test webhook
curl -X POST http://localhost:4001/api/v1/test-callback-sending/send-webhook/TEST_123 \
  -H "Content-Type: application/json" \
  -d '{"eventType": "payment_initiated"}'
```

#### Test Endpoints Available:
- `POST /api/v1/test-callback-sending/test` - Simple echo endpoint for basic testing
- `POST /api/v1/test-callback-sending/create-test-transaction` - Create test transaction
- `POST /api/v1/test-callback-sending/send-webhook/:orderId` - Send test webhook
- `GET /api/v1/test-callback-sending/webhook-queue-status` - Check queue status
- `POST /api/v1/test-callback-sending/receive-webhook` - Test webhook receiver

## Troubleshooting

### Common Issues

1. **Invalid Signature**
   - Check webhook secret matches
   - Ensure you're using raw request body
   - Verify HMAC calculation

2. **Missing Headers**
   - Check for `X-Webhook-Signature` header
   - Verify `Content-Type: application/json`

3. **Timeout Issues**
   - Webhook has 30-second timeout
   - Respond quickly with 200 status
   - Process heavy tasks asynchronously

### Debug Mode
Enable debug logging to see webhook details:

```javascript
// Add to your webhook handler
console.log('Webhook Headers:', req.headers);
console.log('Webhook Body:', req.body);
console.log('Signature Verification:', isValid);
```

## Webhook Retry Policy

Currently, webhooks are sent once without automatic retries. For reliability:

1. Always respond with HTTP 200 for successful processing
2. Implement your own retry mechanism if needed
3. Use the manual retry endpoint if required:

```bash
curl -X POST http://localhost:4001/api/v1/webhooks/retry/ORDER_123
```

## Support

For webhook integration support:
- Check logs for detailed error messages
- Use test endpoints for development
- Verify signatures match expected format
- Ensure callback URLs are publicly accessible

---

**Last Updated:** September 22, 2025  
**Version:** 1.0