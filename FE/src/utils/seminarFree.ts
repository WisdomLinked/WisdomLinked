export function isSavedFreeSeminar(seminar: { price?: unknown; status?: string | null }): boolean {
  if (seminar.status === 'draft') return false;
  const price = seminar.price;
  if (price === null || price === undefined || String(price).trim() === '') return false;
  return Number(price) === 0;
}
