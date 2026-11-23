-- Exact trusted denial seams only. No delivery/reward/ACL changes.
begin;
do $migration$
declare definition text;old_branch text;new_branch text;
begin
 old_branch:='if prior.user_id<>p_user or prior.product_id<>p_product or prior.revoked_at is not null then raise exception ''Purchase belongs to another account or was revoked'';end if;';
 new_branch:='if prior.revoked_at is not null then raise exception ''Purchase belongs to another account or was revoked'';end if;
  if prior.user_id<>p_user then raise exception ''Purchase belongs to another account or was revoked'' using errcode=''22023'', detail=''MEADOW_STORE_RECEIPT_OWNER_CONFLICT_V1'';end if;
  if prior.product_id<>p_product then raise exception ''Purchase belongs to another account or was revoked'' using errcode=''22023'', detail=''MEADOW_STORE_RECEIPT_PRODUCT_CONFLICT_V1'';end if;';
 definition:=pg_get_functiondef('meadow_private.deliver_store_purchase239(uuid,text,text,text,boolean)'::regprocedure);
 if position(new_branch in definition)=0 then
  if (length(definition)-length(replace(definition,old_branch,'')))/length(old_branch)<>1 then raise exception 'Review store binding denial seam before applying';end if;
  execute replace(definition,old_branch,new_branch);
 end if;
 old_branch:='if r.receipt_id is not null then if r.transaction_id<>p_transaction then raise exception ''Ad nonce reused'';end if;return true;end if;';
 new_branch:='if r.receipt_id is not null then if r.transaction_id<>p_transaction then raise exception ''Ad nonce reused'' using errcode=''22023'', detail=jsonb_build_object(''code'',''MEADOW_AD_NONCE_TRANSACTION_CONFLICT_V1'',''actor'',r.user_id)::text;end if;return true;end if;';
 definition:=pg_get_functiondef('public.meadow_market_finish_ad_reward(uuid,text,text,timestamptz)'::regprocedure);
 if position(new_branch in definition)=0 then
  if (length(definition)-length(replace(definition,old_branch,'')))/length(old_branch)<>1 then raise exception 'Review reward nonce denial seam before applying';end if;
  execute replace(definition,old_branch,new_branch);
 end if;
end $migration$;
commit;
