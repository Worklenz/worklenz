interface ReceiptData {
  receiptNumber: string;
  date: string;
  amount: number;
  currency: string;
  transactionId: string | null;
  orderId: string | null;
  cardNumber: string | null;
  planName: string | null;
  userName: string | null;
  userEmail: string | null;
  orgName: string | null;
}

export class LkrReceiptTemplate {
  static generate(d: ReceiptData): string {
    const fmt = (n: number, cur: string) =>
      `${cur} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Payment Receipt</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a2e; background: #fff; font-size: 14px; }
  .page { max-width: 680px; margin: 0 auto; padding: 48px 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .brand { font-size: 22px; font-weight: 700; color: #1890ff; letter-spacing: -0.5px; }
  .brand span { color: #1a1a2e; }
  .badge { background: #f6ffed; border: 1px solid #b7eb8f; color: #389e0d; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px; }
  h1 { font-size: 28px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
  .subtitle { color: #8c8c8c; font-size: 13px; }
  .divider { border: none; border-top: 1px solid #f0f0f0; margin: 24px 0; }
  .two-col { display: flex; gap: 32px; margin-bottom: 32px; }
  .col { flex: 1; }
  .label { font-size: 11px; font-weight: 600; color: #8c8c8c; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .value { font-size: 14px; color: #1a1a2e; }
  .amount-box { background: #f0f7ff; border-radius: 12px; padding: 24px 28px; margin-bottom: 32px; display: flex; justify-content: space-between; align-items: center; }
  .amount-label { font-size: 13px; color: #595959; }
  .amount-value { font-size: 28px; font-weight: 700; color: #1890ff; }
  .details-table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
  .details-table tr { border-bottom: 1px solid #f5f5f5; }
  .details-table tr:last-child { border-bottom: none; }
  .details-table td { padding: 10px 0; font-size: 13px; }
  .details-table td:first-child { color: #8c8c8c; width: 45%; }
  .details-table td:last-child { color: #1a1a2e; font-weight: 500; text-align: right; }
  .footer { border-top: 1px solid #f0f0f0; padding-top: 20px; text-align: center; font-size: 11px; color: #bfbfbf; }
  .footer strong { color: #8c8c8c; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="brand">Work<span>lenz</span></div>
    </div>
    <div class="badge">✓ Payment Successful</div>
  </div>

  <h1>Payment Receipt</h1>
  <p class="subtitle">Receipt #${d.receiptNumber}</p>

  <hr class="divider" />

  <div class="amount-box">
    <div>
      <div class="amount-label">Amount Paid</div>
      ${d.planName ? `<div style="font-size:13px;color:#595959;margin-top:4px;">${d.planName}</div>` : ''}
    </div>
    <div class="amount-value">${fmt(d.amount, d.currency)}</div>
  </div>

  <div class="two-col">
    ${d.orgName || d.userName ? `
    <div class="col">
      <div class="label">Billed To</div>
      ${d.orgName ? `<div class="value" style="font-weight:600;">${d.orgName}</div>` : ''}
      ${d.userName ? `<div class="value">${d.userName}</div>` : ''}
      ${d.userEmail ? `<div class="value" style="color:#595959;">${d.userEmail}</div>` : ''}
    </div>` : ''}
    <div class="col">
      <div class="label">Payment Date</div>
      <div class="value">${d.date}</div>
    </div>
  </div>

  <table class="details-table">
    ${d.transactionId ? `<tr><td>Transaction ID</td><td>${d.transactionId}</td></tr>` : ''}
    ${d.orderId ? `<tr><td>Order Reference</td><td>${d.orderId}</td></tr>` : ''}
    ${d.cardNumber ? `<tr><td>Payment Method</td><td>Card ending ${d.cardNumber.slice(-4)}</td></tr>` : ''}
    <tr><td>Currency</td><td>${d.currency}</td></tr>
    <tr><td>Status</td><td style="color:#389e0d;font-weight:600;">Paid</td></tr>
  </table>

  <div class="footer">
    <strong>Worklenz</strong> — This is an automatically generated receipt.<br />
    For support, contact <strong>support@worklenz.com</strong>
  </div>
</div>
</body>
</html>`;
  }
}
