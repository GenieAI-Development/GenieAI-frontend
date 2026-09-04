-- Run once in Supabase SQL Editor before the embedding backfill.

create extension if not exists vector with schema extensions;

create table if not exists public.kapruka_gift_product_embeddings (
  assigned_category text not null,
  product_id text not null,
  searchable_text text not null,
  content_hash text not null,
  embedding extensions.vector(384) not null,
  embedding_model text not null,
  source_updated_at timestamptz,
  embedded_at timestamptz not null default now(),

  constraint kapruka_gift_product_embeddings_pkey
    primary key (assigned_category, product_id),
  constraint kapruka_gift_product_embeddings_source_fkey
    foreign key (assigned_category, product_id)
    references public.kapruka_gift_products (assigned_category, product_id)
    on delete cascade
);

create index if not exists kapruka_gift_product_embeddings_vector_idx
  on public.kapruka_gift_product_embeddings
  using hnsw (embedding vector_cosine_ops);

create index if not exists kapruka_gift_product_embeddings_model_idx
  on public.kapruka_gift_product_embeddings (embedding_model);

alter table public.kapruka_gift_product_embeddings enable row level security;
revoke all on table public.kapruka_gift_product_embeddings from anon, authenticated;

create or replace function public.match_kapruka_gift_products(
  query_embedding extensions.vector(384),
  match_count integer default 20,
  filter_category text default null,
  min_price numeric default null,
  max_price numeric default null
)
returns table (
  assigned_category text,
  product_id text,
  name text,
  summary text,
  description text,
  price_amount numeric,
  currency text,
  in_stock boolean,
  stock_level text,
  image_url text,
  kapruka_category jsonb,
  product_url text,
  similarity double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    p.assigned_category,
    p.product_id,
    p.name,
    p.summary,
    p.description,
    p.price_amount,
    p.currency,
    p.in_stock,
    p.stock_level,
    p.image_url,
    p.kapruka_category,
    p.product_url,
    1 - (e.embedding OPERATOR(extensions.<=>) query_embedding) as similarity
  from public.kapruka_gift_product_embeddings e
  join public.kapruka_gift_products p
    on p.assigned_category = e.assigned_category
   and p.product_id = e.product_id
  where p.in_stock is true
    and (filter_category is null or p.assigned_category = filter_category)
    and (min_price is null or p.price_amount >= min_price)
    and (max_price is null or p.price_amount <= max_price)
    and e.embedding_model = 'sentence-transformers/all-MiniLM-L6-v2'
  order by e.embedding OPERATOR(extensions.<=>) query_embedding
  limit greatest(1, least(match_count, 60));
$$;

revoke all on function public.match_kapruka_gift_products(
  extensions.vector, integer, text, numeric, numeric
) from public, anon, authenticated;
grant execute on function public.match_kapruka_gift_products(
  extensions.vector, integer, text, numeric, numeric
) to service_role;

comment on table public.kapruka_gift_product_embeddings is
  'One semantic-search embedding per Kapruka product category record.';
