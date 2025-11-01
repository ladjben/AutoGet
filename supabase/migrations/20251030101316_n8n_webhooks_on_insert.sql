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
  -- ⚠️ Mets ici l'URL **Production** de ton Webhook n8n
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
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := v_payload::text
  );

  return NEW;
end;
$$;

-- Fonction enrichie pour les lignes d'entrée avec les détails du produit
create or replace function public.notify_n8n_entree_ligne()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := 'https://n8n.ikleelcos.com/webhook/whatsapp-stock';
  v_payload jsonb;
  v_entree record;
  v_variante record;
  v_produit record;
begin
  -- Récupérer les infos de l'entrée (date, fournisseur, etc.)
  select * into v_entree from entrees where id = NEW.entree_id;
  
  -- Récupérer les infos de la variante
  select * into v_variante from variantes where id = NEW.variante_id;
  
  -- Récupérer les infos du produit
  select * into v_produit from produits where id = v_variante.produit_id;
  
  -- Construire un payload enrichi avec toutes les infos
  v_payload := jsonb_build_object(
    'table', 'entree_lignes',
    'action', 'INSERT',
    'timestamp', now(),
    'entree', jsonb_build_object(
      'id', v_entree.id,
      'date', v_entree.date,
      'fournisseur_id', v_entree.fournisseur_id,
      'paye', v_entree.paye
    ),
    'produit', jsonb_build_object(
      'id', v_produit.id,
      'nom', v_produit.nom,
      'reference', v_produit.reference,
      'prix_achat', v_produit.prix_achat
    ),
    'variante', jsonb_build_object(
      'id', v_variante.id,
      'taille', v_variante.taille,
      'couleur', v_variante.couleur,
      'modele', v_variante.modele
    ),
    'quantite', NEW.quantite,
    'ligne_id', NEW.id
  );

  -- Envoi HTTP vers n8n (asynchrone)
  perform net.http_post(
    url := v_url,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := v_payload::text
  );

  return NEW;
end;
$$;

-- (Re)crée les triggers pour les 3 tables cibles

-- Dépenses
drop trigger if exists trg_depenses_n8n on public.depenses;
create trigger trg_depenses_n8n
after insert on public.depenses
for each row execute function public.notify_n8n_on_insert();

-- Entrées de stock (en-tête)
drop trigger if exists trg_entrees_n8n on public.entrees;
create trigger trg_entrees_n8n
after insert on public.entrees
for each row execute function public.notify_n8n_on_insert();

-- Lignes d'entrée (détails avec produit, quantité, etc.)
drop trigger if exists trg_entree_lignes_n8n on public.entree_lignes;
create trigger trg_entree_lignes_n8n
after insert on public.entree_lignes
for each row execute function public.notify_n8n_entree_ligne();
