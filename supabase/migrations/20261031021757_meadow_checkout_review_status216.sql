-- A refund review must prevent opening a new payment, not only its delivery.
do $migration$
declare body text;marker text;
begin
 body:=pg_get_functiondef('meadow_private.commerce_status()'::regprocedure);
 marker:='''payments_enabled'',(c.payments_enabled and c.production_ready and protected) or license_test,';
 if position(marker in body)=0 then raise exception 'Review commerce status before adding refund entry guard';end if;
 body:=replace(body,marker,$gate$'purchase_review_required',exists(select 1 from meadow_private.store_review_holds h where h.user_id=u),
  'payments_enabled',(c.payments_enabled and c.production_ready and protected and not exists(select 1 from meadow_private.store_review_holds h where h.user_id=u)) or license_test,$gate$);
 execute body;
end $migration$;
