CREATE OR REPLACE FUNCTION public.meadow_market_play_service(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$begin perform meadow_private.control_guard(case when p_action='status' then 'read' when p_action in('board','score') then 'ranked' else 'play' end,auth.uid()); return meadow_private.play_service(p_action,p_data);end $function$;
