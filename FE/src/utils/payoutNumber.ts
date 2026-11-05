export type PayoutNumberType = 'cheque' | 'reference';

export const PAYOUT_NUMBER_LABELS: Record<PayoutNumberType, string> = {
  cheque: 'Cheque number',
  reference: 'Reference number',
};

/** Records saved before reference numbers existed have no type and are cheques. */
export function payoutNumberType(value?: string | null): PayoutNumberType {
  return value === 'reference' ? 'reference' : 'cheque';
}

/** A number for a shared "Cheque / reference number" column. Only references are marked, so old rows read as before. */
export function payoutNumberText(payout: { numberType?: string | null; chequeNumber?: string | null }): string {
  const number = payout.chequeNumber || '';
  if (!number) return '—';
  return payoutNumberType(payout.numberType) === 'reference' ? `Reference ${number}` : number;
}
