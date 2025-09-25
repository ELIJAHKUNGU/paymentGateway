# C2B (Customer to Business) API Documentation

This document provides comprehensive documentation for the C2B payment APIs, including request/response payloads and examples.

## Base URL
```
https://your-domain.com/api/v1
```

## Authentication
Most endpoints require Bearer token authentication using the `accessToken` middleware.

---

## 1. Register C2B URLs

Register validation and confirmation URLs with Safaricom M-Pesa.

**Endpoint:** `POST /c2b/register-urls`  
**Authentication:** Required  

### Request Payload
```json
{
  "shortCode": "601426",
  "responseType": "Completed"
}
```

### Request Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| shortCode | String | Yes | Your M-Pesa paybill/till number (5-6 digits) |
| responseType | String | No | Default action when validation fails: "Completed" or "Cancelled" (default: "Completed") |

### What Gets Sent to Safaricom
The service automatically constructs the complete payload that Safaricom expects:
```json
{
  "ShortCode": "601426",
  "ResponseType": "Completed",
  "ConfirmationURL": "https://your-domain.com/api/v1/c2b/confirmation",
  "ValidationURL": "https://your-domain.com/api/v1/c2b/validation"
}
```

### Success Response (200)
```json
{
  "message": "C2B URLs registered successfully",
  "data": {
    "OriginatorCoversationID": "7619-37765134-1",
    "ResponseCode": "0",
    "ResponseDescription": "success"
  }
}
```

### Error Response (400/500)
```json
{
  "message": "Missing required field: shortCode"
}
```

---

## 2. C2B Validation Endpoint

**This endpoint is called by Safaricom, not your client applications.**

**Endpoint:** `POST /c2b/validation`  
**Authentication:** None (Safaricom callback)  

### Request Payload (from Safaricom)
```json
{
  "TransactionType": "Pay Bill",
  "TransID": "RKTQDM7W6S",
  "TransTime": "20191122063845",
  "TransAmount": "10",
  "BusinessShortCode": "600638",
  "BillRefNumber": "invoice008",
  "InvoiceNumber": "",
  "OrgAccountBalance": "",
  "ThirdPartyTransID": "",
  "MSISDN": "254708374149",
  "FirstName": "John",
  "MiddleName": "",
  "LastName": "Doe"
}
```

### Success Response (200) - Accept Transaction
```json
{
  "ResultCode": "0",
  "ResultDesc": "Accepted"
}
```

### Success Response (200) - Reject Transaction
```json
{
  "ResultCode": "C2B00012",
  "ResultDesc": "Rejected - Invalid Account Number"
}
```

### Error Codes
| Code | Description |
|------|-------------|
| C2B00011 | Invalid MSISDN |
| C2B00012 | Invalid Account Number |
| C2B00013 | Invalid Amount |
| C2B00014 | Invalid KYC Details |
| C2B00015 | Invalid Shortcode |
| C2B00016 | Other Error |

---

## 3. C2B Confirmation Endpoint

**This endpoint is called by Safaricom, not your client applications.**

**Endpoint:** `POST /c2b/confirmation`  
**Authentication:** None (Safaricom callback)  

### Request Payload (from Safaricom)
```json
{
  "TransactionType": "Pay Bill",
  "TransID": "RKTQDM7W6S",
  "TransTime": "20191122063845",
  "TransAmount": "10",
  "BusinessShortCode": "600638",
  "BillRefNumber": "invoice008",
  "InvoiceNumber": "",
  "OrgAccountBalance": "49197.00",
  "ThirdPartyTransID": "",
  "MSISDN": "254708374149",
  "FirstName": "John",
  "MiddleName": "",
  "LastName": "Doe"
}
```

### Success Response (200)
```json
{
  "ResultCode": "0",
  "ResultDesc": "Success"
}
```

### Error Response (200)
```json
{
  "ResultCode": "1",
  "ResultDesc": "Failed - Processing Error"
}
```

---

## 4. Simulate C2B Payment

Simulate a C2B payment for testing purposes (Sandbox only).

**Endpoint:** `POST /c2b/simulate`  
**Authentication:** Required  

### Request Payload
```json
{
  "shortCode": "600977",
  "amount": "100",
  "msisdn": "254708374149",
  "billRefNumber": "TestAccount123",
  "commandID": "CustomerPayBillOnline"
}
```

### Request Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| shortCode | String | Yes | Your M-Pesa paybill/till number |
| amount | String/Number | Yes | Payment amount |
| msisdn | String | Yes | Customer phone number (254XXXXXXXXX) |
| billRefNumber | String | No | Account reference (default: "TestAccount") |
| commandID | String | No | "CustomerPayBillOnline" or "CustomerBuyGoodsOnline" |

### Success Response (200)
```json
{
  "message": "C2B payment simulation initiated",
  "data": {
    "OriginatorCoversationID": "19455-424534-1",
    "ResponseCode": "0",
    "ResponseDescription": "Accept the service request successfully."
  }
}
```

### Error Response (400/500)
```json
{
  "message": "Missing required fields",
  "required": ["shortCode", "amount", "msisdn"]
}
```

---

## 5. Get C2B Health Status

Check the health status of the C2B service.

**Endpoint:** `GET /c2b/health`  
**Authentication:** None  

### Success Response (200)
```json
{
  "service": "C2B Service",
  "status": "healthy",
  "message": "C2B service configuration is valid",
  "endpoints": {
    "validation": "https://your-domain.com/api/v1/c2b/validation",
    "confirmation": "https://your-domain.com/api/v1/c2b/confirmation"
  },
  "timestamp": "2023-11-22T10:30:45.123Z"
}
```

### Unhealthy Response (503)
```json
{
  "service": "C2B Service",
  "status": "unhealthy",
  "error": "Missing environment variables: safaricom_baseurl",
  "timestamp": "2023-11-22T10:30:45.123Z"
}
```

---

## 6. Get C2B Service Statistics

Get C2B service configuration and statistics.

**Endpoint:** `GET /c2b/stats`  
**Authentication:** None  

### Success Response (200)
```json
{
  "service": "C2B Service",
  "apiBaseUrl": "https://sandbox.safaricom.co.ke",
  "callbackBaseUrl": "https://your-domain.com",
  "endpoints": {
    "registerUrl": "https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl",
    "validation": "https://your-domain.com/api/v1/c2b/validation",
    "confirmation": "https://your-domain.com/api/v1/c2b/confirmation"
  },
  "connectionPooling": {
    "maxSockets": 50,
    "maxFreeSockets": 10,
    "timeout": 30000
  },
  "timestamp": "2023-11-22T10:30:45.123Z"
}
```

---

## 7. Get C2B Transactions

Retrieve C2B transactions with filtering and pagination.

**Endpoint:** `GET /c2b/transactions`  
**Authentication:** None  

### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | Number | No | Page number (default: 1) |
| limit | Number | No | Items per page (default: 50) |
| phoneNumber | String | No | Filter by customer phone number |
| businessShortCode | String | No | Filter by business shortcode |
| transactionType | String | No | Filter by type: "Pay Bill" or "Buy Goods" |
| fromDate | String | No | Filter from date (ISO format) |
| toDate | String | No | Filter to date (ISO format) |

### Example Request
```
GET /c2b/transactions?page=1&limit=10&transactionType=Pay Bill&fromDate=2023-11-01
```

### Success Response (200)
```json
{
  "message": "C2B transactions retrieved successfully",
  "data": [
    {
      "orderId": "C2B_RKTQDM7W6S_1700654445123",
      "mpesaTransactionId": "RKTQDM7W6S",
      "phoneNumber": "254708374149",
      "amount": 100,
      "transactionType": "Pay Bill",
      "businessShortCode": "600638",
      "billRefNumber": "invoice008",
      "status": "completed",
      "paymentMethod": "c2b",
      "customerName": {
        "first": "John",
        "middle": "",
        "last": "Doe"
      },
      "transactionTime": "20191122063845",
      "createdAt": "2023-11-22T10:30:45.123Z",
      "updatedAt": "2023-11-22T10:30:45.123Z"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 10,
    "totalPages": 15,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

## 8. Get C2B Transaction Statistics

Get comprehensive C2B transaction analytics.

**Endpoint:** `GET /c2b/transaction-stats`  
**Authentication:** None  

### Success Response (200)
```json
{
  "message": "C2B statistics retrieved successfully",
  "data": {
    "totalTransactions": 1250,
    "totalAmount": 2500000,
    "todayTransactions": 45,
    "weekTransactions": 320,
    "transactionTypes": {
      "payBill": 800,
      "buyGoods": 450
    },
    "recentActivity": [
      {
        "orderId": "C2B_RKTQDM7W6S_1700654445123",
        "mpesaTransactionId": "RKTQDM7W6S",
        "amount": 100,
        "phoneNumber": "254708374149",
        "transactionType": "Pay Bill",
        "businessShortCode": "600638",
        "createdAt": "2023-11-22T10:30:45.123Z"
      }
    ]
  },
  "timestamp": "2023-11-22T10:30:45.123Z"
}
```

---

## Environment Variables Required

```env
# Safaricom API Configuration
safaricom_baseurl=https://sandbox.safaricom.co.ke
safaricomconsumerKey=your_consumer_key
safaricomconsumerSecret=your_consumer_secret
safaricom_callbackurl=https://your-domain.com

# For production, use:
# safaricom_baseurl=https://api.safaricom.co.ke
```

---

## Integration Flow

### 1. Initial Setup
1. Call `POST /c2b/register-urls` to register your validation and confirmation URLs with Safaricom
2. Ensure your server is accessible from the internet for Safaricom callbacks

### 2. Payment Flow
1. Customer makes payment to your paybill/till number via M-Pesa
2. Safaricom sends validation request to your `/c2b/validation` endpoint (if enabled)
3. Your system validates and responds with accept/reject
4. If accepted, Safaricom processes the payment
5. Safaricom sends confirmation to your `/c2b/confirmation` endpoint
6. Your system stores the transaction and can trigger webhooks

### 3. Testing
1. Use `POST /c2b/simulate` to simulate payments in sandbox environment
2. Monitor `/c2b/health` for service status
3. Use `/c2b/transactions` and `/c2b/transaction-stats` for analytics

---

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (missing/invalid access token)
- `500`: Internal Server Error
- `503`: Service Unavailable (health check failure)

Error responses include descriptive messages:
```json
{
  "message": "Error description",
  "error": "Detailed error information"
}
```