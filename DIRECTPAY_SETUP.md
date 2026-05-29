# DirectPay Integration Setup Guide

## Required Credentials

To integrate DirectPay payment gateway, you need the following credentials from DirectPay:

### 1. Merchant ID (`DP_MERCHANT_ID`)
- Your unique merchant identifier assigned by DirectPay
- Example: `123456`
- **Where to get it**: Provided by DirectPay during merchant onboarding

### 2. Secret Key (`DP_SECRET_KEY`)
- HMAC SHA-256 secret key for API authentication
- Example: `vs6568s7v2aklsdv687a3dn8a6q92z`
- **Where to get it**: Provided by DirectPay during merchant onboarding
- ⚠️ **Keep this secure!** Never commit to version control

### 3. Base URL (`DP_BASE_URL`)
- DirectPay gateway endpoint
- **Test Environment**: `https://test-gateway.directpay.lk`
- **Production**: `https://gateway.directpay.lk`

### 4. Stage (`DP_STAGE`)
- Environment stage
- **Values**: `DEV` or `PROD`

## Configuration Steps

### Step 1: Get DirectPay Credentials

Contact DirectPay to get your merchant account:
- **Website**: https://directpay.lk
- **Email**: support@directpay.lk (update with actual contact)
- **Request**: Merchant account for card tokenization/wallet management

### Step 2: Update Backend Environment Variables

Edit the file: `/worklenz-license-manager-backend/.env`

Add these lines (replace with your actual credentials):

```env
# DirectPay Payment Gateway
DP_MERCHANT_ID=your_actual_merchant_id
DP_SECRET_KEY=your_actual_secret_key
DP_BASE_URL=https://test-gateway.directpay.lk
DP_STAGE=DEV

# URLs for DirectPay callbacks
BACKEND_URL=http://localhost:3001
SERVER_URL=http://localhost:3001
FRONTEND_URL=http://localhost:4200
```

### Step 3: Update URLs for Your Environment

**For Development:**
```env
BACKEND_URL=http://localhost:3001
FRONTEND_URL=http://localhost:4200
DP_BASE_URL=https://test-gateway.directpay.lk
DP_STAGE=DEV
```

**For Production:**
```env
BACKEND_URL=https://api.worklenz.com
FRONTEND_URL=https://app.worklenz.com
DP_BASE_URL=https://gateway.directpay.lk
DP_STAGE=PROD
```

### Step 4: Restart Backend Server

After updating the `.env` file, restart your backend server:

```bash
cd "/home/chamika/Documents/projects/Worklenz/Worklenz Admin/worklenz-license-manager-backend"
npm run dev
# or
pm2 restart worklenz-backend
```

## Testing the Integration

### 1. Start Both Servers

**Backend:**
```bash
cd "/home/chamika/Documents/projects/Worklenz/Worklenz Admin/worklenz-license-manager-backend"
npm run dev
```

**Frontend:**
```bash
cd /home/chamika/Documents/projects/Worklenz/worklenz-business/worklenz-frontend
npm start
```

### 2. Test Payment Flow

1. Navigate to: http://localhost:4200/worklenz/admin-center/billing
2. Click "Upgrade Now" on the Business plan
3. DirectPay payment modal should open
4. Use DirectPay test cards (they will provide test card numbers)

### 3. Verify Webhook

DirectPay will send webhook notifications to:
```
POST https://your-backend-url/api/billing/directpay/webhook
```

Make sure this endpoint is publicly accessible for production.

## DirectPay Test Cards

DirectPay will provide test card numbers for testing. Common test scenarios:

- **Successful Payment**: Use specific test card number provided by DirectPay
- **Failed Payment**: Use failure test card
- **3DS Authentication**: Use 3DS test card

## Troubleshooting

### Error: "Invalid merchant ID"
- Check that `DP_MERCHANT_ID` matches what DirectPay provided
- Ensure no extra spaces or quotes in the value

### Error: "Invalid signature"
- Verify `DP_SECRET_KEY` is correct
- Check for any encoding issues in the secret key

### Error: "Failed to create card session"
- Ensure backend server is running
- Check backend logs for detailed error messages
- Verify `DP_BASE_URL` is correct for your environment

### DirectPay SDK not loading
- Check browser console for errors
- Ensure frontend can access DirectPay's CDN
- Verify no CORS issues

## Production Checklist

Before going to production:

- [ ] Get production credentials from DirectPay
- [ ] Update `DP_STAGE` to `PROD`
- [ ] Update `DP_BASE_URL` to production URL
- [ ] Set proper `BACKEND_URL` (publicly accessible)
- [ ] Set proper `FRONTEND_URL`
- [ ] Configure webhook URL with DirectPay
- [ ] Test complete payment flow in production
- [ ] Set up monitoring for failed payments
- [ ] Configure email notifications for payment failures

## API Endpoints Used

The integration uses these DirectPay API endpoints:

1. **Create Session** - `/api/v3/create-session`
   - Used to initialize card add/payment flow

2. **Card Pay** - `/api/v3/cardPay`
   - Used for charging stored cards (recurring payments)

3. **List Cards** - `/api/v3/listCard`
   - Retrieve user's saved cards

4. **Delete Card** - `/api/v3/deleteCard`
   - Remove a saved card

## Support

- **DirectPay Documentation**: Refer to `Tokenization.-.DirectPay.IPG.User.Wise.Card.Manage.API.Documentation.pdf`
- **DirectPay Support**: Contact DirectPay support team
- **Worklenz Internal**: Contact your development team lead

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit** `DP_SECRET_KEY` to version control
2. **Use environment variables** for all sensitive data
3. **Enable HTTPS** in production for webhook endpoint
4. **Validate webhook signatures** (already implemented)
5. **Log all payment attempts** for audit trail
6. **Monitor for suspicious activity**

## File Locations

**Backend Configuration:**
- Environment file: `/worklenz-license-manager-backend/.env`
- Controller: `/worklenz-license-manager-backend/src/controllers/directpay-controller.ts`
- Routes: `/worklenz-license-manager-backend/src/routes/apis/directpay-api-router.ts`
- Gateway: `/worklenz-license-manager-backend/src/services/payment-gateways/directpay-gateway.ts`

**Frontend Integration:**
- Main component: `/worklenz-frontend/src/components/admin-center/billing/drawers/upgrade-plans-lkr/upgrade-plans-lkr.tsx`
- Helper functions: `/worklenz-frontend/src/components/admin-center/billing/drawers/upgrade-plans-lkr/direct-pay-helper.ts`
- API service: `/worklenz-frontend/src/api/admin-center/billing.api.service.ts`
