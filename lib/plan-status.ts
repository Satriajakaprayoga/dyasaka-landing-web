import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Plan status recompute (doc §15), shared by the plan-lines API and
 * the purchase-orders API — both mutate the data a plan's status is
 * derived from (line links, received quantities).
 *
 * Line execution status is DERIVED, never stored: no order link and no
 * done_at = not executed; linked to an order line = ordered; the order
 * line fully received, or done_at set = done.
 */

/** A line counts as done when its linked order line is fully
 * received or done_at is set. */
export function isPlanLineDone(
  line: {
    done_at: string | null;
    purchase_order_items: { quantity_ordered: number; quantity_received: number } | null;
  } | null,
): boolean {
  if (!line) return false;
  if (line.done_at) return true;
  const po = line.purchase_order_items;
  return !!po && po.quantity_received >= po.quantity_ordered;
}

/**
 * Recompute a plan's status from its lines. Cancelled plans are never
 * touched; draft stays draft until the admin approves it. Statuses
 * never regress: the recompute only advances (approved → in_progress
 * → done), so unlinking a dead order leaves the status alone.
 */
export async function recomputePlanStatus(
  supabase: SupabaseClient,
  planId: string,
): Promise<void> {
  const { data: plan } = await supabase
    .from('purchase_plans')
    .select('status')
    .eq('id', planId)
    .maybeSingle();

  if (!plan || plan.status === 'cancelled' || plan.status === 'draft') return;

  const { data: lines } = await supabase
    .from('purchase_plan_lines')
    .select('done_at, purchase_order_items(quantity_ordered, quantity_received)')
    .eq('plan_id', planId);

  const all = lines ?? [];
  if (all.length === 0) return;

  const anyExecuted = all.some(
    (l) => l.done_at != null || l.purchase_order_items != null,
  );
  const allDone = all.every((l) => isPlanLineDone(l as never));

  let next: string | null = null;
  if (allDone) next = 'done';
  else if (anyExecuted && plan.status === 'approved') next = 'in_progress';

  if (next && next !== plan.status) {
    await supabase.from('purchase_plans').update({ status: next }).eq('id', planId);
  }
}
