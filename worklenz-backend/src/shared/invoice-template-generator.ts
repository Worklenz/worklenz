/**
 * Shared Invoice HTML Template Generator
 * Generates a professional, print-ready invoice HTML template
 * Used for both PDF generation and print preview
 */

interface InvoiceData {
  invoiceNumber: string;
  status: string;
  createdAt: string;
  dueDate: string | null;
  amount: number;
  currency: string;
  isOverdue?: boolean;
  client: {
    name: string;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  request?: {
    requestNumber: string;
    service?: {
      name: string;
      description?: string;
    };
  } | null;
  notes?: string | null;
  organization?: {
    name: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
    email: string | null;
    phone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    invoiceFooterMessage: string | null;
  };
}

export class InvoiceTemplateGenerator {
  /**
   * Format date to readable string
   */
  private static formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Format currency
   */
  private static formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }

  /**
   * Get status text
   */
  private static getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      paid: 'Paid',
      sent: 'Sent',
      draft: 'Draft',
      overdue: 'Overdue',
      cancelled: 'Cancelled',
    };
    return statusMap[status] || status;
  }

  /**
   * Get status badge style
   */
  private static getStatusBadgeStyle(status: string): string {
    const styleMap: Record<string, string> = {
      paid: 'background: #f6ffed; color: #52c41a;',
      sent: 'background: #e6f7ff; color: #1890ff;',
      overdue: 'background: #fff2f0; color: #ff4d4f;',
      draft: 'background: #f5f5f5; color: #666;',
      cancelled: 'background: #f5f5f5; color: #666;',
    };
    return styleMap[status] || 'background: #f5f5f5; color: #666;';
  }

  /**
   * Build client address parts
   */
  private static getClientAddressParts(client: InvoiceData['client']): string[] {
    const parts: string[] = [];
    if (client.companyName) parts.push(client.companyName);
    if (client.address) parts.push(client.address);
    if (client.email) parts.push(client.email);
    if (client.phone) parts.push(client.phone);
    return parts;
  }

  /**
   * Escape HTML to prevent XSS
   */
  private static escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Generate complete invoice HTML template
   */
  public static generateInvoiceHTML(invoice: InvoiceData): string {
    const primaryColor = invoice.organization?.primaryColor || '#1890ff';
    const organizationName = invoice.organization?.name || 'Your Company';
    const organizationEmail = invoice.organization?.email || '';
    const organizationPhone = invoice.organization?.phone || '';
    const organizationAddressLine1 = invoice.organization?.addressLine1 || '';
    const organizationAddressLine2 = invoice.organization?.addressLine2 || '';
    const organizationLogo = invoice.organization?.logoUrl || '';
    const invoiceFooterMessage = invoice.organization?.invoiceFooterMessage || '';
    const serviceName = invoice.request?.service?.name || 'Service Items';
    const clientAddressParts = this.getClientAddressParts(invoice.client);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Invoice - ${this.escapeHtml(invoice.invoiceNumber)}</title>
          <style>
            @page {
              size: A4;
              margin: 20mm;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              color: #333;
              line-height: 1.5;
              background: #fff;
            }
            .invoice-container {
              max-width: 800px;
              margin: 0 auto;
              padding: 40px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 3px solid ${primaryColor};
            }
            .company-section {
              display: flex;
              align-items: center;
              gap: 16px;
            }
            .company-logo {
              width: 60px;
              height: 60px;
              border-radius: 8px;
              background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #fff;
              font-weight: 700;
              font-size: 28px;
            }
            .company-logo img {
              width: 100%;
              height: 100%;
              object-fit: contain;
              border-radius: 8px;
            }
            .company-info h1 {
              font-size: 24px;
              color: ${primaryColor};
              margin-bottom: 4px;
            }
            .company-info p {
              font-size: 13px;
              color: #666;
              margin: 2px 0;
            }
            .invoice-title-section {
              text-align: right;
            }
            .invoice-title-section h2 {
              font-size: 36px;
              color: #333;
              font-weight: 300;
              letter-spacing: 2px;
              margin-bottom: 8px;
            }
            .invoice-number {
              font-size: 16px;
              color: #666;
              margin-bottom: 8px;
            }
            .status-badge {
              display: inline-block;
              padding: 6px 16px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              ${this.getStatusBadgeStyle(invoice.status)}
            }
            .meta-section {
              display: flex;
              justify-content: space-between;
              margin-bottom: 40px;
              gap: 40px;
            }
            .bill-to, .invoice-details {
              flex: 1;
            }
            .section-label {
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 1px;
              color: #999;
              margin-bottom: 8px;
              font-weight: 600;
            }
            .bill-to-name {
              font-size: 18px;
              font-weight: 600;
              color: #333;
              margin-bottom: 4px;
            }
            .bill-to-details {
              font-size: 14px;
              color: #666;
            }
            .invoice-details-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
            }
            .detail-item .label {
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #999;
              margin-bottom: 4px;
            }
            .detail-item .value {
              font-size: 14px;
              font-weight: 500;
              color: #333;
            }
            .detail-item .value.highlight {
              font-size: 20px;
              color: ${primaryColor};
              font-weight: 700;
            }
            .detail-item .value.danger {
              color: #ff4d4f;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .items-table th {
              background: #f8f9fa;
              padding: 14px 16px;
              text-align: left;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #666;
              font-weight: 600;
              border-bottom: 2px solid #e8e8e8;
            }
            .items-table th:last-child,
            .items-table td:last-child {
              text-align: right;
            }
            .items-table th:nth-child(2),
            .items-table th:nth-child(3),
            .items-table td:nth-child(2),
            .items-table td:nth-child(3) {
              text-align: center;
            }
            .items-table td {
              padding: 16px;
              border-bottom: 1px solid #eee;
              font-size: 14px;
              color: #333;
            }
            .totals-section {
              display: flex;
              justify-content: flex-end;
              margin-bottom: 40px;
            }
            .totals-box {
              width: 280px;
            }
            .totals-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              font-size: 14px;
              color: #666;
            }
            .totals-row.total {
              font-size: 18px;
              font-weight: 700;
              color: #333;
              border-top: 2px solid #333;
              padding-top: 16px;
              margin-top: 8px;
            }
            .totals-row.total .amount {
              color: ${primaryColor};
              font-size: 22px;
            }
            .notes-section {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 40px;
            }
            .notes-section h3 {
              font-size: 13px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #666;
              margin-bottom: 10px;
            }
            .notes-section p {
              font-size: 14px;
              color: #555;
              line-height: 1.6;
            }
            .footer {
              text-align: center;
              padding-top: 30px;
              border-top: 1px solid #eee;
            }
            .footer p {
              font-size: 13px;
              color: #999;
            }
            .footer .thank-you {
              font-size: 16px;
              color: #666;
              margin-bottom: 8px;
            }
            @media print {
              .invoice-container {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="header">
              <div class="company-section">
                <div class="company-logo">
                  ${organizationLogo 
                    ? `<img src="${this.escapeHtml(organizationLogo)}" alt="Logo" />`
                    : this.escapeHtml(organizationName.charAt(0).toUpperCase())
                  }
                </div>
                <div class="company-info">
                  <h1>${this.escapeHtml(organizationName)}</h1>
                  ${organizationEmail ? `<p>${this.escapeHtml(organizationEmail)}</p>` : ''}
                  ${organizationPhone ? `<p>${this.escapeHtml(organizationPhone)}</p>` : ''}
                  ${organizationAddressLine1 ? `<p>${this.escapeHtml(organizationAddressLine1)}</p>` : ''}
                  ${organizationAddressLine2 ? `<p>${this.escapeHtml(organizationAddressLine2)}</p>` : ''}
                </div>
              </div>
              <div class="invoice-title-section">
                <h2>INVOICE</h2>
                <p class="invoice-number">#${this.escapeHtml(invoice.invoiceNumber)}</p>
                <span class="status-badge">${this.getStatusText(invoice.status)}</span>
              </div>
            </div>

            <div class="meta-section">
              <div class="bill-to">
                <p class="section-label">BILLED TO</p>
                <p class="bill-to-name">${this.escapeHtml(invoice.client?.name || '-')}</p>
                <div class="bill-to-details">
                  ${clientAddressParts.map(part => `<p>${this.escapeHtml(part)}</p>`).join('')}
                </div>
              </div>
              <div class="invoice-details">
                <div class="invoice-details-grid">
                  <div class="detail-item">
                    <p class="label">Invoice Date</p>
                    <p class="value">${this.formatDate(invoice.createdAt)}</p>
                  </div>
                  <div class="detail-item">
                    <p class="label">Due Date</p>
                    <p class="value ${invoice.isOverdue ? 'danger' : ''}">${this.formatDate(invoice.dueDate)}</p>
                  </div>
                  <div class="detail-item">
                    <p class="label">Reference</p>
                    <p class="value">${this.escapeHtml(invoice.request?.requestNumber || '-')}</p>
                  </div>
                  <div class="detail-item">
                    <p class="label">Total</p>
                    <p class="value highlight">${this.formatCurrency(invoice.amount, invoice.currency)}</p>
                  </div>
                </div>
              </div>
            </div>

            <table class="items-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Quantity</th>
                  <th>Rate</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${this.escapeHtml(serviceName)}</td>
                  <td>1</td>
                  <td>${this.formatCurrency(invoice.amount, invoice.currency)}</td>
                  <td>${this.formatCurrency(invoice.amount, invoice.currency)}</td>
                </tr>
              </tbody>
            </table>

            <div class="totals-section">
              <div class="totals-box">
                <div class="totals-row">
                  <span>Subtotal</span>
                  <span>${this.formatCurrency(invoice.amount, invoice.currency)}</span>
                </div>
                <div class="totals-row">
                  <span>Tax (0%)</span>
                  <span>${this.formatCurrency(0, invoice.currency)}</span>
                </div>
                <div class="totals-row total">
                  <span>Total</span>
                  <span class="amount">${this.formatCurrency(invoice.amount, invoice.currency)}</span>
                </div>
              </div>
            </div>

            ${invoice.notes ? `
              <div class="notes-section">
                <h3>Notes</h3>
                <p>${this.escapeHtml(invoice.notes)}</p>
              </div>
            ` : ''}

            <div class="footer">
              ${invoiceFooterMessage ? `<p class="thank-you">${this.escapeHtml(invoiceFooterMessage)}</p>` : ''}
              <p>${this.escapeHtml(organizationName)}${organizationEmail ? ` • ${this.escapeHtml(organizationEmail)}` : ''}${organizationPhone ? ` • ${this.escapeHtml(organizationPhone)}` : ''}</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}
