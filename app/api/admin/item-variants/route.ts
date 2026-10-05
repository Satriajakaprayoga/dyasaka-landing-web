import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    item_id,
    color,
    size,
    sku,
    stock_quantity,
    current_price,
    reorder_point,
  } = await req.json();

  console.log({ item_id, current_price });

  if (!item_id || current_price === undefined || current_price === null) {
    return NextResponse.json(
      { error: "Item and current_price are required" },
      { status: 400 },
    );
  }

  const initialStock = Number(stock_quantity ?? 0);

  const { data, error } = await supabase
    .from("item_variants")
    .insert({
      item_id,
      color: color || null,
      size: size || null,
      sku: sku || null,
      stock_quantity: initialStock,
      current_price,
      reorder_point: reorder_point ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Keep the append-only ledger the source of truth: initial stock is
  // recorded as a movement so stock_quantity stays derivable from it.
  if (initialStock > 0) {
    await supabase.from("stock_movements").insert({
      item_variant_id: data.id,
      type: "restock",
      quantity: initialStock,
      note: "Stok awal",
    });
  }

  return NextResponse.json({ variant: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: "Missing variant id" }, { status: 400 });
  }

  // stock_quantity is intentionally NOT patchable — stock only changes
  // through stock_movements so the ledger stays authoritative.
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.color !== undefined) patch.color = body.color || null;
  if (body.size !== undefined) patch.size = body.size || null;
  if (body.sku !== undefined) patch.sku = body.sku || null;
  if (body.reorder_point !== undefined)
    patch.reorder_point = body.reorder_point;

  const { data: existing, error: fetchError } = await supabase
    .from("item_variants")
    .select("current_price")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  const priceChanged =
    body.current_price !== undefined &&
    Number(body.current_price) !== Number(existing.current_price);

  if (priceChanged) {
    // Append-only history: the old price is never lost. Written before
    // the update so a failure midway leaves a recoverable state.
    const { error: historyError } = await supabase
      .from("item_price_history")
      .insert({
        item_variant_id: id,
        price: body.current_price,
        effective_from: new Date().toISOString(),
      });

    if (historyError) {
      return NextResponse.json(
        { error: historyError.message },
        { status: 500 },
      );
    }

    patch.current_price = body.current_price;
  }

  const { data, error } = await supabase
    .from("item_variants")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ variant: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing variant id" }, { status: 400 });
  }

  const { error } = await supabase.from("item_variants").delete().eq("id", id);

  if (error) {
    // Blocked by RESTRICT when price history, stock movements,
    // product_items, or booking_items reference the variant.
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
