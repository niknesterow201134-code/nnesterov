// Test script — simulates a RoboKassa payment webhook
// Sends a properly signed POST to the Edge Function
// Run: node test_payment.js [email]

const https = require('node:https');
const crypto = require('node:crypto');

const WEBHOOK_URL = 'https://wmcrshretrerwvcjxper.supabase.co/functions/v1/robokassa-webhook';
const PASSWORD2   = '3sHZsu6isn9nisf';

// Test payment params
const OUT_SUM = '1990.00';
const INV_ID  = 'test_' + Date.now();
const EMAIL   = process.argv[2] || 'nik.nesterow201134@gmail.com';

// Compute valid MD5 signature (same algorithm as RoboKassa uses)
// Format: MD5(OutSum:InvId:Password2:shp_email=EMAIL)
const raw = `${OUT_SUM}:${INV_ID}:${PASSWORD2}:shp_email=${EMAIL}`;
const signature = crypto.createHash('md5').update(raw).digest('hex').toUpperCase();

const body = new URLSearchParams({
    OutSum:         OUT_SUM,
    InvId:          INV_ID,
    SignatureValue: signature,
    shp_email:      EMAIL,
    Fee:            '0',
    EMail:          EMAIL,
}).toString();

console.log('=== Test RoboKassa Payment Webhook ===');
console.log(`Email:     ${EMAIL}`);
console.log(`Amount:    ${OUT_SUM} RUB`);
console.log(`InvId:     ${INV_ID}`);
console.log(`Signature: ${signature}`);
console.log('Sending to Edge Function...\n');

const url = new URL(WEBHOOK_URL);
const req = https.request({
    hostname: url.hostname,
    path:     url.pathname,
    method:   'POST',
    headers: {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
    }
}, res => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
        console.log(`Response: HTTP ${res.statusCode}`);
        console.log(`Body:     ${data}`);
        if (res.statusCode === 200) {
            console.log(`\n✓ SUCCESS — invite email sent to ${EMAIL}`);
            console.log('Check your inbox and click "Accept the invitation"');
            console.log('You should see the "Set your password" screen on the platform');
        } else {
            console.log('\n✗ FAILED — check the output above');
        }
    });
});
req.on('error', e => console.error('Request error:', e));
req.write(body);
req.end();
