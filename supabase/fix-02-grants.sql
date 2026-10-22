-- Fix 02: only signed-in users can call staff/donor functions; trigger functions are not callable through the API.
-- (Already applied to the live project on 22 Oct 2026. Safe to run again.)
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.donation_to_unit() from public, anon, authenticated;
revoke execute on function public.camp_worklist(uuid), public.set_reg_status(uuid,text),
  public.save_screening(uuid,numeric,int,int,numeric,int,text,text,date,text), public.record_donation(uuid,text,int,text),
  public.walk_in(uuid,text,text,blood_group,date,text,boolean), public.claim_donor(text,date,boolean), public.my_portal(),
  public.register_me(uuid,text), public.set_unit_status(uuid,text,text), public.add_unit(text,blood_group,int,date,text),
  public.handover_units(uuid[],text,text), public.camp_report(uuid) from public, anon;
grant execute on function public.camp_worklist(uuid), public.set_reg_status(uuid,text),
  public.save_screening(uuid,numeric,int,int,numeric,int,text,text,date,text), public.record_donation(uuid,text,int,text),
  public.walk_in(uuid,text,text,blood_group,date,text,boolean), public.claim_donor(text,date,boolean), public.my_portal(),
  public.register_me(uuid,text), public.set_unit_status(uuid,text,text), public.add_unit(text,blood_group,int,date,text),
  public.handover_units(uuid[],text,text), public.camp_report(uuid) to authenticated;
