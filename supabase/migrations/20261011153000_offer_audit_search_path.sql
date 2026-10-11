-- Qualify the audit table so secure callers with an empty search_path can create offers.
create or replace function public.log_offer_action() returns trigger
language plpgsql set search_path='' as $$
begin
 insert into public.api_action_log(user_id,action_type) values(NEW.sponsor_id,'offer_create');
 return NEW;
end; $$;
