import { revalidatePath } from "next/cache";
import { requirePage, requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

async function saveProduct(form: FormData) {
  "use server";
  await requireRole("manager");
  const id = String(form.get("id") || "");
  const row = {
    name: String(form.get("name")).trim(),
    category: String(form.get("category")) as "snack" | "retail" | "vr",
    sku: String(form.get("sku") || "").trim() || null,
    price: Number(form.get("price")),
    track_stock: form.get("track_stock") === "on",
    low_stock_threshold: Number(form.get("low") || 0),
    active: form.get("active") !== "off",
  };
  if (!row.name || !(row.price >= 0)) throw new Error("Name and price are required");
  const db = supabaseAdmin();
  const { error } = id ? await db.from("products").update(row).eq("id", id) : await db.from("products").insert(row);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
}

async function adjustStock(form: FormData) {
  "use server";
  const staff = await requireRole("manager");
  const id = String(form.get("id"));
  const change = Math.trunc(Number(form.get("change")));
  if (!change) return;
  const db = supabaseAdmin();
  const { data: p } = await db.from("products").select("stock_qty").eq("id", id).single();
  if (!p) throw new Error("Product not found");
  if (p.stock_qty + change < 0) throw new Error("Stock cannot go below zero");
  await db.from("products").update({ stock_qty: p.stock_qty + change }).eq("id", id);
  await db.from("stock_movements").insert({ product_id: id, change, reason: change > 0 ? "restock" : "adjust", created_by: staff.id });
  revalidatePath("/admin/products");
}

export default async function ProductsPage() {
  await requirePage("manager");
  const { data: products } = await supabaseAdmin().from("products").select("*").order("category").order("name");
  const low = (products ?? []).filter((p) => p.active && p.track_stock && p.stock_qty <= p.low_stock_threshold);

  return (
    <div className="space-y-4">
      <h1 className="h1">Products, VR & stock</h1>
      {low.length > 0 && (
        <div className="rounded-xl bg-warn/15 p-3">
          <strong>Low stock:</strong> {low.map((p) => `${p.name} (${p.stock_qty})`).join(", ")}
        </div>
      )}

      <form action={saveProduct} className="card grid items-end gap-3 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <label className="label">New product name</label>
          <input name="name" className="input" required placeholder="e.g. VR Space Ride, Juice box" />
        </div>
        <div>
          <label className="label">Category</label>
          <select name="category" className="input">
            <option value="snack">Snack</option>
            <option value="retail">Retail</option>
            <option value="vr">VR game / slot</option>
          </select>
        </div>
        <div>
          <label className="label">Price (Rs)</label>
          <input name="price" type="number" step="any" min={0} className="input" required />
        </div>
        <div>
          <label className="label">SKU / barcode</label>
          <input name="sku" className="input" />
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="track_stock" defaultChecked /> Track stock</label>
          <input type="hidden" name="low" value="5" />
          <button className="btn-primary">Add</button>
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Category</th><th>SKU</th><th>Price</th><th>Stock</th><th>Adjust stock</th><th>Edit</th></tr>
          </thead>
          <tbody>
            {(products ?? []).map((p) => (
              <tr key={p.id} className={p.active ? "" : "opacity-50"}>
                <td className="font-semibold">{p.name}</td>
                <td className="capitalize">{p.category}</td>
                <td>{p.sku}</td>
                <td>{money(p.price)}</td>
                <td className={p.track_stock && p.stock_qty <= p.low_stock_threshold ? "font-bold text-danger" : ""}>
                  {p.track_stock ? p.stock_qty : "—"}
                </td>
                <td>
                  {p.track_stock && (
                    <form action={adjustStock} className="flex gap-1">
                      <input type="hidden" name="id" value={p.id} />
                      <input name="change" type="number" className="input w-20 py-1" placeholder="+/-" />
                      <button className="btn-ghost py-1">Apply</button>
                    </form>
                  )}
                </td>
                <td>
                  <details>
                    <summary className="cursor-pointer text-brand">Edit</summary>
                    <form action={saveProduct} className="mt-2 grid w-64 gap-2">
                      <input type="hidden" name="id" value={p.id} />
                      <input name="name" className="input py-1" defaultValue={p.name} />
                      <select name="category" className="input py-1" defaultValue={p.category}>
                        <option value="snack">Snack</option>
                        <option value="retail">Retail</option>
                        <option value="vr">VR</option>
                      </select>
                      <input name="price" type="number" step="any" className="input py-1" defaultValue={p.price} />
                      <input name="sku" className="input py-1" defaultValue={p.sku ?? ""} placeholder="SKU" />
                      <label className="text-sm">Low-stock alert at <input name="low" type="number" className="input inline w-16 py-1" defaultValue={p.low_stock_threshold} /></label>
                      <label className="text-sm"><input type="checkbox" name="track_stock" defaultChecked={p.track_stock} /> Track stock</label>
                      <select name="active" className="input py-1" defaultValue={p.active ? "on" : "off"}>
                        <option value="on">Active</option>
                        <option value="off">Inactive</option>
                      </select>
                      <button className="btn-primary py-1">Save</button>
                    </form>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
