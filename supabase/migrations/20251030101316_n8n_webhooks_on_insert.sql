-- Active l’extension HTTP côté Supabase
create extension if not exists "pg_net";

-- Fonction générique qui notifie n8n sur chaque INSERT
create or replace function public.notify_n8n_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- ⚠️ Mets ici l’URL **Production** de ton Webhook n8n
  v_url text := 'https://n8n.ikleelcos.com/webhook/whatsapp-stock';
  v_payload jsonb;
begin
  -- Construire un payload propre
  v_payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'action', TG_OP,                     -- 'INSERT'
    'timestamp', now(),
    'row', to_jsonb(NEW)
  );

  -- Envoi HTTP vers n8n (asynchrone)
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := v_payload::text
  );

  return NEW;
end;
$$;

-- (Re)crée les triggers pour les 2 tables cibles

-- Dépenses
drop trigger if exists trg_depenses_n8n on public.depenses;
create trigger trg_depenses_n8n
after insert on public.depenses
for each row execute function public.notify_n8n_on_insert();

-- Entrées de stock
drop trigger if exists trg_entrees_n8n on public.entrees;
create trigger trg_entrees_n8n
after insert on public.entrees
for each row execute function public.notify_n8n_on_insert();
