-- Active l'extension HTTP côté Supabase
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Supprimer toutes les anciennes fonctions et triggers
DROP FUNCTION IF EXISTS public.notify_n8n() CASCADE;
DROP FUNCTION IF EXISTS public.notify_n8n_entree_ligne() CASCADE;
DROP FUNCTION IF EXISTS public.notify_n8n_on_insert() CASCADE;
DROP FUNCTION IF EXISTS public.notify_n8n_on_entree_ligne() CASCADE;

DROP TRIGGER IF EXISTS trg_depenses_n8n ON public.depenses CASCADE;
DROP TRIGGER IF EXISTS trg_entrees_n8n ON public.entrees CASCADE;

-- Fonction générique qui notifie n8n sur chaque INSERT
CREATE FUNCTION public.notify_n8n_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := 'https://n8n.ikleelcos.com/webhook/whatsapp-stock';
  v_payload jsonb;
  v_request_id bigint;
BEGIN
  -- Construire un payload propre
  v_payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'action', TG_OP,
    'timestamp', now(),
    'row', to_jsonb(NEW)
  );

  -- Envoi HTTP vers n8n (asynchrone) via pg_net
  SELECT net.http_post(
    v_url,
    v_payload,
    '{}'::jsonb,
    '{"Content-Type": "application/json"}'::jsonb
  ) INTO v_request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

-- Recréer les triggers pour les 2 tables cibles

-- Dépenses
CREATE TRIGGER trg_depenses_n8n
  AFTER INSERT ON public.depenses
  FOR EACH ROW EXECUTE FUNCTION public.notify_n8n_on_insert();

-- Entrées de stock
CREATE TRIGGER trg_entrees_n8n
  AFTER INSERT ON public.entrees
  FOR EACH ROW EXECUTE FUNCTION public.notify_n8n_on_insert();
