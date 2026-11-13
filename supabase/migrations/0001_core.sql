-- Adventure Cove – Phase 1 core schema
-- Apply in Supabase SQL editor (or `supabase db push`).
-- Security model: RLS is ON for every table. Authenticated staff may READ.
-- All WRITES go through Next.js server actions using the service-role key
-- after the server has checked the staff member's role.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- enums
create type staff_role as enum ('owner', 'manager', 'cashier', 'staff');
create type gender_t as enum ('male', 'female', 'other');
create type visit_status as enum ('open', 'closed', 'void');
create type item_type as enum ('vr', 'product', 'buddy', 'other');
create type product_category as enum ('snack', 'retail', 'vr');
create type pay_method as enum ('cash', 'card', 'transfer', 'points', 'pass');

-- ---------------------------------------------------------------- settings
create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into settings (key, value) values
  ('play_pricing', '{"firstHour":1000,"nextHour":800,"bufferMinutes":15,"warningMinutes":5}'),
  ('buddy_pricing', '{"firstHour":1000,"nextHour":800,"bufferMinutes":15,"commissionPerHour":150}'),
  ('sibling_discount', '{"percent":10}'),
  ('taxes', '[{"name":"Service Charge","rate":10,"enabled":false},{"name":"VAT","rate":18,"enabled":false}]'),
  ('venue', '{"name":"Adventure Cove","tagline":"Play Smart, Big Adventures","address":"","phone":"","bankDetails":"","whatsapp":""}'),
  ('display', '{"token":"change-me"}');

-- ---------------------------------------------------------------- staff
create table staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role staff_role not null default 'cashier',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- families & children
create table families (
  id uuid primary key default gen_random_uuid(),
  parent_name text not null,
  mobile text not null unique,
  email text not null,
  nic text not null,
  source text not null default 'desk', -- desk | online
  created_at timestamptz not null default now()
);

create table children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  first_name text not null,
  last_name text not null default '',
  dob date not null,
  gender gender_t not null,
  allergies text not null default '',
  medical_notes text not null default '',
  qr_token text not null unique default encode(gen_random_bytes(9), 'hex'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on children (family_id);

-- ---------------------------------------------------------------- visits
create table visits (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id),
  status visit_status not null default 'open',
  adults_count int not null default 0,         -- guardians: free of charge
  opened_by uuid references staff_profiles(id),
  closed_by uuid references staff_profiles(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
create index on visits (status);
create unique index one_open_visit_per_family on visits (family_id) where status = 'open';

-- One row per child per visit = the play timer
create table play_sessions (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  child_id uuid not null references children(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index on play_sessions (visit_id);
create unique index one_active_session_per_child on play_sessions (child_id) where ended_at is null;

-- Staff buddy (hourly, assigned staff, commission)
create table buddy_sessions (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  child_id uuid not null references children(id),
  staff_id uuid not null references staff_profiles(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  billed_hours int,
  amount numeric(12,2),
  commission numeric(12,2)
);
create index on buddy_sessions (visit_id);
create index on buddy_sessions (staff_id);

-- ---------------------------------------------------------------- products & stock
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category product_category not null,
  sku text unique,
  price numeric(12,2) not null check (price >= 0),
  track_stock boolean not null default true,
  stock_qty int not null default 0,
  low_stock_threshold int not null default 5,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table stock_movements (
  id bigint generated always as identity primary key,
  product_id uuid not null references products(id),
  change int not null,
  reason text not null,          -- sale | void | restock | adjust
  ref_id uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- Add-ons attached to an open visit (VR, snacks, retail, other)
create table visit_items (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  child_id uuid references children(id),
  type item_type not null,
  product_id uuid references products(id),
  description text not null,
  qty int not null check (qty > 0),
  unit_price numeric(12,2) not null,
  created_by uuid references staff_profiles(id),
  created_at timestamptz not null default now()
);
create index on visit_items (visit_id);

-- ---------------------------------------------------------------- invoices
create sequence invoice_seq start 1001;

create table invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('AC-' || nextval('invoice_seq')),
  visit_id uuid not null unique references visits(id),
  family_id uuid not null references families(id),
  subtotal numeric(12,2) not null,
  discount_total numeric(12,2) not null,
  tax_lines jsonb not null default '[]',
  tax_total numeric(12,2) not null,
  total numeric(12,2) not null,
  paid_total numeric(12,2) not null,
  change_due numeric(12,2) not null default 0,
  created_by uuid references staff_profiles(id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references staff_profiles(id)
);
create index on invoices (created_at);

create table invoice_lines (
  id bigint generated always as identity primary key,
  invoice_id uuid not null references invoices(id) on delete cascade,
  child_id uuid references children(id),
  kind text not null,                -- play | buddy | vr | product | other
  description text not null,
  qty numeric(12,2) not null,
  unit_price numeric(12,2) not null,
  gross numeric(12,2) not null,
  discount numeric(12,2) not null default 0,
  discount_reason text,
  net numeric(12,2) not null,
  meta jsonb not null default '{}'
);

create table payments (
  id bigint generated always as identity primary key,
  invoice_id uuid not null references invoices(id) on delete cascade,
  method pay_method not null,
  amount numeric(12,2) not null check (amount > 0),
  reference text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- helper: role check
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff_profiles where id = auth.uid() and active);
$$;

-- ---------------------------------------------------------------- RLS: staff read-only
do $$
declare t text;
begin
  foreach t in array array['settings','staff_profiles','families','children','visits','play_sessions',
    'buddy_sessions','products','stock_movements','visit_items','invoices','invoice_lines','payments']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy staff_read on %I for select to authenticated using (public.is_staff())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- atomic stock + add-on
create or replace function public.add_product_item(
  p_visit uuid, p_child uuid, p_product uuid, p_qty int, p_staff uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare prod products; item_id uuid;
begin
  select * into prod from products where id = p_product and active for update;
  if not found then raise exception 'Product not found'; end if;
  if not exists (select 1 from visits where id = p_visit and status = 'open') then
    raise exception 'Visit is not open';
  end if;
  if prod.track_stock and prod.stock_qty < p_qty then
    raise exception 'Only % in stock for %', prod.stock_qty, prod.name;
  end if;
  insert into visit_items (visit_id, child_id, type, product_id, description, qty, unit_price, created_by)
  values (p_visit, p_child, case when prod.category = 'vr' then 'vr'::item_type else 'product'::item_type end,
          prod.id, prod.name, p_qty, prod.price, p_staff)
  returning id into item_id;
  if prod.track_stock then
    update products set stock_qty = stock_qty - p_qty where id = prod.id;
    insert into stock_movements (product_id, change, reason, ref_id, created_by)
    values (prod.id, -p_qty, 'sale', item_id, p_staff);
  end if;
  return item_id;
end $$;

create or replace function public.remove_visit_item(p_item uuid, p_staff uuid)
returns void language plpgsql security definer set search_path = public as $$
declare it visit_items;
begin
  select vi.* into it from visit_items vi join visits v on v.id = vi.visit_id
   where vi.id = p_item and v.status = 'open' for update;
  if not found then raise exception 'Item not found or visit closed'; end if;
  if it.product_id is not null and exists (select 1 from products where id = it.product_id and track_stock) then
    update products set stock_qty = stock_qty + it.qty where id = it.product_id;
    insert into stock_movements (product_id, change, reason, ref_id, created_by)
    values (it.product_id, it.qty, 'void', it.id, p_staff);
  end if;
  delete from visit_items where id = p_item;
end $$;

-- ---------------------------------------------------------------- atomic checkout
-- Lines/totals are computed by the app's pricing engine (src/lib/pricing.ts)
-- and passed in; this function writes everything in ONE transaction.
create or replace function public.finalize_checkout(
  p_visit uuid, p_staff uuid, p_ended_at timestamptz,
  p_subtotal numeric, p_discount numeric, p_tax_lines jsonb, p_tax_total numeric,
  p_total numeric, p_paid numeric, p_change numeric,
  p_lines jsonb, p_payments jsonb, p_buddies jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v visits; inv_id uuid; l jsonb; p jsonb; b jsonb;
begin
  select * into v from visits where id = p_visit for update;
  if not found or v.status <> 'open' then raise exception 'Visit is not open'; end if;
  if p_paid < p_total then raise exception 'Payment is less than total'; end if;

  update play_sessions set ended_at = p_ended_at where visit_id = p_visit and ended_at is null;

  for b in select * from jsonb_array_elements(p_buddies) loop
    update buddy_sessions set
      ended_at = coalesce(ended_at, p_ended_at),
      billed_hours = (b->>'billedHours')::int,
      amount = (b->>'amount')::numeric,
      commission = (b->>'commission')::numeric
    where id = (b->>'id')::uuid and visit_id = p_visit;
  end loop;

  insert into invoices (visit_id, family_id, subtotal, discount_total, tax_lines, tax_total, total,
                        paid_total, change_due, created_by)
  values (p_visit, v.family_id, p_subtotal, p_discount, p_tax_lines, p_tax_total, p_total,
          p_paid, p_change, p_staff)
  returning id into inv_id;

  for l in select * from jsonb_array_elements(p_lines) loop
    insert into invoice_lines (invoice_id, child_id, kind, description, qty, unit_price, gross,
                               discount, discount_reason, net, meta)
    values (inv_id, nullif(l->>'childId','')::uuid, l->>'kind', l->>'description',
            (l->>'qty')::numeric, (l->>'unitPrice')::numeric, (l->>'gross')::numeric,
            (l->>'discount')::numeric, l->>'discountReason', (l->>'net')::numeric,
            coalesce(l->'meta','{}'::jsonb));
  end loop;

  for p in select * from jsonb_array_elements(p_payments) loop
    insert into payments (invoice_id, method, amount, reference)
    values (inv_id, (p->>'method')::pay_method, (p->>'amount')::numeric, p->>'reference');
  end loop;

  update visits set status = 'closed', closed_at = p_ended_at, closed_by = p_staff where id = p_visit;
  return inv_id;
end $$;

revoke execute on function public.add_product_item, public.remove_visit_item, public.finalize_checkout
  from public, anon, authenticated;

-- ---------------------------------------------------------------- realtime for desk screens
alter publication supabase_realtime add table play_sessions, visits, visit_items, buddy_sessions;
