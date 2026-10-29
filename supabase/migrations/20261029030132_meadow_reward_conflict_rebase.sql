-- Owner-only response patches for the explicit keep-this-device conflict choice.
create index meadow_farm_reward_patch_cursor on meadow_private.farm_save_receipts(user_id,((patch->>'to')::bigint)) where jsonb_array_length(patch->'receipts')>0;
create function meadow_private.rebase_farm_rewards(p_from_cursor bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); saved public.meadow_market_saves; target bigint; patches jsonb;
begin
 if u is null then raise exception 'Sign in before reviewing farm rewards' using errcode='28000';end if;
 select * into saved from public.meadow_market_saves where user_id=u;
 if not found then raise exception 'Online farm not found';end if;
 target:=coalesce((saved.save_data->'_farmEconomy'->>'cursor')::bigint,0);
 if p_from_cursor is null or p_from_cursor<0 or p_from_cursor>target then raise exception 'Load the online farm to recover its newer rewards';end if;
 if target-p_from_cursor>1000 then raise exception 'There are many newer rewards. Load the online farm to keep them all';end if;
 select coalesce(jsonb_agg(patch order by ((patch->>'to')::bigint)),'[]') into patches
 from meadow_private.farm_save_receipts where user_id=u and jsonb_array_length(patch->'receipts')>0
  and (patch->>'to')::bigint>p_from_cursor and (patch->>'to')::bigint<=target;
 if octet_length(patches::text)>1048576 then raise exception 'There are many newer rewards. Load the online farm to keep them all';end if;
 return jsonb_build_object('revision',saved.revision,'cursor',target,'patches',patches);
end $$;
revoke all on function meadow_private.rebase_farm_rewards(bigint) from public,anon;
grant execute on function meadow_private.rebase_farm_rewards(bigint) to authenticated;
create function public.meadow_market_rebase_farm_rewards(p_from_cursor bigint) returns jsonb
language sql security invoker set search_path='' as $$select meadow_private.rebase_farm_rewards(p_from_cursor)$$;
revoke all on function public.meadow_market_rebase_farm_rewards(bigint) from public,anon;
grant execute on function public.meadow_market_rebase_farm_rewards(bigint) to authenticated;
