'use strict';

const { Payment } = require('../models');
const { formatCurrency } = require('../utils/helpers');

/** Sequential-ish invoice numbers: ES-2026-000137. */
const nextInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const count = await Payment.countDocuments({ 'invoice.number': { $regex: `^ES-${year}-` } });
  return `ES-${year}-${String(count + 1).padStart(6, '0')}`;
};

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const PURPOSE_LABELS = {
  booth_booking: 'Booth booking',
  event_ticket: 'Event ticket',
  session: 'Session / workshop',
  expo_registration: 'Expo registration',
  other: 'EventSphere service',
};

/**
 * Server-rendered, print-ready invoice. Returning HTML keeps the invoice
 * dependency-free and lets the client "Save as PDF" from the browser.
 */
const renderInvoiceHtml = (payment, { organization = 'EventSphere Events', logoUrl = '' } = {}) => {
  const billedTo = payment.invoice?.billedTo || {};
  const rows = [
    {
      description: payment.description || PURPOSE_LABELS[payment.purpose] || 'EventSphere payment',
      quantity: 1,
      unit: payment.amount,
    },
  ];

  const lineRows = rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.description)}</td>
          <td class="num">${row.quantity}</td>
          <td class="num">${escapeHtml(formatCurrency(row.unit, payment.currency))}</td>
          <td class="num">${escapeHtml(formatCurrency(row.quantity * row.unit, payment.currency))}</td>
        </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Invoice ${escapeHtml(payment.invoice?.number || payment._id)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px; background: #f5f6fa; color: #0f172a; }
  .sheet { max-width: 820px; margin: 0 auto; background: #fff; border-radius: 14px; padding: 40px; box-shadow: 0 10px 40px rgba(15,23,42,.08); }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 24px; }
  .brand { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
  .muted { color: #64748b; font-size: 13px; }
  h1 { font-size: 26px; margin: 0 0 6px; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
  .badge.paid { background: #dcfce7; color: #166534; }
  .badge.pending { background: #fef3c7; color: #92400e; }
  .badge.failed, .badge.cancelled { background: #fee2e2; color: #991b1b; }
  .badge.refunded { background: #e0e7ff; color: #3730a3; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 28px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
  th { background: #f8fafc; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: #475569; }
  td.num, th.num { text-align: right; }
  .totals { margin-top: 20px; margin-left: auto; width: 320px; }
  .totals div { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
  .totals .grand { border-top: 2px solid #0f172a; font-weight: 700; font-size: 18px; margin-top: 8px; padding-top: 12px; }
  .foot { margin-top: 36px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
  .actions { max-width: 820px; margin: 0 auto 16px; display: flex; justify-content: flex-end; gap: 10px; }
  .actions button { background: #4f46e5; color: #fff; border: 0; padding: 10px 18px; border-radius: 10px; font-weight: 600; cursor: pointer; }
  @media print { body { background: #fff; padding: 0; } .sheet { box-shadow: none; border-radius: 0; } .actions { display: none; } }
</style>
</head>
<body>
  <div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>
  <div class="sheet">
    <div class="head">
      <div>
        <div class="brand">${escapeHtml(organization)}</div>
        <div class="muted">Expo &amp; event management platform</div>
      </div>
      <div style="text-align:right">
        <h1>Invoice</h1>
        <div class="muted">${escapeHtml(payment.invoice?.number || 'Draft')}</div>
        <div class="muted">Issued ${payment.invoice?.issuedAt ? new Date(payment.invoice.issuedAt).toDateString() : new Date().toDateString()}</div>
        <div style="margin-top:8px">
          <span class="badge ${escapeHtml(payment.status)}">${escapeHtml(payment.status)}</span>
        </div>
      </div>
    </div>

    <div class="grid">
      <div>
        <div class="muted">Billed to</div>
        <strong>${escapeHtml(billedTo.name || 'Customer')}</strong>
        <div class="muted">${escapeHtml(billedTo.company || '')}</div>
        <div class="muted">${escapeHtml(billedTo.email || '')}</div>
        <div class="muted">${escapeHtml(billedTo.address || '')}</div>
      </div>
      <div style="text-align:right">
        <div class="muted">Transaction ID</div>
        <strong>${escapeHtml(payment.transactionId || '—')}</strong>
        <div class="muted">Provider: ${escapeHtml(payment.provider)}</div>
        <div class="muted">Purpose: ${escapeHtml(PURPOSE_LABELS[payment.purpose] || payment.purpose)}</div>
        ${
          payment.metadata?.boothNumber
            ? `<div class="muted">Booth: ${escapeHtml(payment.metadata.boothNumber)}</div>`
            : ''
        }
      </div>
    </div>

    <table>
      <thead>
        <tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr>
      </thead>
      <tbody>${lineRows}</tbody>
    </table>

    <div class="totals">
      <div><span>Subtotal</span><span>${escapeHtml(formatCurrency(payment.amount, payment.currency))}</span></div>
      <div><span>Tax</span><span>${escapeHtml(formatCurrency(payment.tax || 0, payment.currency))}</span></div>
      <div class="grand"><span>Total</span><span>${escapeHtml(formatCurrency(payment.total, payment.currency))}</span></div>
    </div>

    <div class="foot muted">
      This invoice was generated by EventSphere. Payments are processed by the configured provider —
      EventSphere never stores card details. Questions? Open a support ticket from your dashboard.
    </div>
  </div>
</body>
</html>`;
};

module.exports = { nextInvoiceNumber, renderInvoiceHtml, PURPOSE_LABELS, escapeHtml };
