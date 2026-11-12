export interface ReceiptData {
  receiptNo: string;
  amount: number;
  memberName: string;
  memberId: string;
  plan: string;
  /** Payment date, YYYY-MM-DD. */
  paidOn: string;
  periodStart: string | null;
  periodEnd: string | null;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-11-04" -> "November 4, 2026". */
export function longDate(date: string | null): string {
  if (!date) return '—';
  const month = MONTHS[Number(date.slice(5, 7)) - 1] ?? '';
  return `${month} ${Number(date.slice(8, 10))}, ${date.slice(0, 4)}`;
}

export function pesoText(amount: number): string {
  const [whole = '0', cents = '00'] = amount.toFixed(2).split('.');
  return `₱${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${cents}`;
}

/** Every value that goes into the page is escaped: names and plans come from the database. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** The page that Save as PDF and Share turn into a file (SDD Section 4.12). */
export function receiptHtml(r: ReceiptData): string {
  const row = (label: string, value: string) =>
    `<tr><td class="k">${escapeHtml(label)}</td><td class="v">${escapeHtml(value)}</td></tr>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Receipt ${escapeHtml(r.receiptNo)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 32px; }
  .brand { font-size: 22px; font-weight: 700; letter-spacing: .5px; }
  .sub { color: #555; margin-top: 2px; }
  .amount { font-size: 34px; font-weight: 700; margin: 24px 0 4px; }
  table { border-collapse: collapse; width: 100%; margin-top: 12px; }
  td { padding: 8px 0; border-bottom: 1px solid #ddd; }
  td.k { color: #555; width: 40%; }
  .note { margin-top: 28px; font-size: 12px; color: #555; }
</style></head>
<body>
  <div class="brand">NeoFit Fitness Gym</div>
  <div class="sub">Payment receipt</div>
  <div class="amount">${escapeHtml(pesoText(r.amount))}</div>
  <div class="sub">Receipt no. ${escapeHtml(r.receiptNo)}</div>
  <table>
    ${row('Date paid', longDate(r.paidOn))}
    ${row('Member', `${r.memberName} (${r.memberId})`)}
    ${row('Plan', r.plan)}
    ${row('Period covered', `${longDate(r.periodStart)} to ${longDate(r.periodEnd)}`)}
    ${row('Place of payment', 'NeoFit front desk')}
  </table>
  <p class="note">This is a payment acknowledgment, not an official receipt of the Bureau of Internal Revenue.</p>
</body></html>`;
}
