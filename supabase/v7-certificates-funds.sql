-- v7: certificate register (who got which certificate, downloads, WhatsApp), money donations with receipts,
-- club expenses and an accounts summary. Run once, after v6. Nothing is dropped.

-- ---------- permissions: new 'funds' module ----------
create or replace function role_default_perms(r app_role) returns text[] language sql immutable set search_path=public as $$
  select case r
    when 'admin' then array['donors','camps','import','planning','campday','screening','messages','stock','stock_edit','emergency','reports','users','audit','settings','members','meetings','afterlife','funds']
    when 'coordinator' then array['donors','camps','import','planning','campday','messages','stock','emergency','reports','members','meetings','afterlife','funds']
    when 'medical' then array['campday','screening','stock','stock_edit','emergency','afterlife']
    when 'volunteer' then array['campday']
    else array[]::text[] end $$;

-- ---------- certificate tracking ----------
alter table donations add column if not exists cert_issued_at timestamptz;
alter table donations add column if not exists cert_downloads int not null default 0;
alter table donations add column if not exists cert_sent_at timestamptz;

create or replace function log_certificate(p_reg uuid, p_kind text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not (perm('reports') or perm('campday') or perm('screening')
          or exists(select 1 from registrations r join donors d on d.id=r.donor_id where r.id=p_reg and d.user_id=auth.uid())) then
    raise exception 'Not allowed'; end if;
  perform set_config('app.reverting','1',true);   -- bookkeeping only: keep it out of "undo my last change"
  update donations set cert_issued_at=coalesce(cert_issued_at,now()),
    cert_downloads=cert_downloads+case when p_kind='download' then 1 else 0 end,
    cert_sent_at=case when p_kind='whatsapp' then now() else cert_sent_at end
  where registration_id=p_reg;
  perform set_config('app.reverting','',true); end $$;

create or replace function certificate_register(p_from date, p_to date, p_camp uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare full_phone boolean := perm('donors') or perm('reports'); begin
  if not (perm('reports') or perm('campday') or perm('screening')) then raise exception 'Not allowed'; end if;
  return coalesce((select jsonb_agg(x order by (x->>'cert_no')::int desc) from (select jsonb_build_object(
      'reg_id',r.id,'cert_no',n.cert_no,'verify_code',n.verify_code,'donor_no',d.donor_no,'name',d.full_name,'blood_group',d.blood_group,
      'phone',case when full_phone then d.phone else 'XXXXXX'||right(d.phone,4) end,'consent',d.consent,'has_login',d.user_id is not null,
      'camp',c.name,'camp_no',c.camp_no,'camp_id',c.id,'date',c.camp_date,'venue',c.venue,'volume',n.volume_ml,
      'issued_at',n.cert_issued_at,'downloads',n.cert_downloads,'sent_at',n.cert_sent_at) x
    from donations n join registrations r on r.id=n.registration_id join donors d on d.id=r.donor_id join camps c on c.id=r.camp_id
    where c.camp_date between p_from and p_to and (p_camp is null or c.id=p_camp)) s),'[]'::jsonb);
end $$;
revoke execute on function log_certificate(uuid,text), certificate_register(date,date,uuid) from public, anon;
grant execute on function log_certificate(uuid,text), certificate_register(date,date,uuid) to authenticated;

-- donor portal: include the registration id so the donor's own downloads are counted
create or replace function my_portal() returns jsonb language plpgsql security definer set search_path=public as $$
declare d donors; begin
  select * into d from donors where user_id=auth.uid() and deleted_at is null;
  return jsonb_build_object(
    'donor', case when d.id is null then null else jsonb_build_object('name',d.full_name,'donor_no',d.donor_no,'blood_group',d.blood_group,'gender',d.gender,'last_donation',d.last_donation) end,
    'history', coalesce((select jsonb_agg(jsonb_build_object('reg_id',r.id,'code',upper(left(r.id::text,8)),'cert_no',n.cert_no,'verify_code',n.verify_code,'camp',c.name,'venue',c.venue,'date',c.camp_date,'volume',n.volume_ml) order by c.camp_date desc)
      from registrations r join donations n on n.registration_id=r.id join camps c on c.id=r.camp_id where r.donor_id=d.id),'[]'::jsonb),
    'outside', coalesce((select jsonb_agg(jsonb_build_object('date',e.event_date,'place',e.place,'kind',e.kind,'units',e.units) order by e.event_date desc)
      from donor_events e where e.donor_id=d.id and e.kind in ('outside_donation','emergency_donation')),'[]'::jsonb),
    'upcoming', coalesce((select jsonb_agg(jsonb_build_object('camp_id',c.id,'camp',c.name,'date',c.camp_date,'venue',c.venue,'slot',r.slot,'token_no',r.token_no) order by c.camp_date)
      from registrations r join camps c on c.id=r.camp_id where r.donor_id=d.id and r.status in ('registered','checked_in') and c.status in ('open','live','planned') and c.deleted_at is null),'[]'::jsonb),
    'open_camps', coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'date',c.camp_date,'venue',c.venue,'start_time',c.start_time,'end_time',c.end_time) order by c.camp_date)
      from camps c where c.status='open' and c.deleted_at is null),'[]'::jsonb));
end $$;

-- ---------- money donations (contributions) ----------
create sequence if not exists contributions_receipt_no_seq;
create table if not exists contributions(
  id uuid primary key default gen_random_uuid(),
  receipt_no int not null unique,
  donor_name text not null, phone text, email text, address text,
  amount numeric(12,2) not null, received_on date not null default current_date,
  mode text not null default 'UPI' check (mode in ('Cash','UPI','Bank transfer','Cheque','Card')), reference text,
  purpose text not null default 'General fund' check (purpose in ('General fund','Blood donation camp','Eye donation drive','Community service','Emergency medical help','Club events','Other')),
  camp_id uuid references camps on delete set null, member_id uuid references members on delete set null, donor_id uuid references donors on delete set null,
  received_by text, anonymous boolean not null default false, notes text,
  status text not null default 'received' check (status in ('received','cancelled')), cancel_reason text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now());
alter table contributions enable row level security;
create policy "contributions manage" on contributions for all using (perm('funds')) with check (perm('funds'));

-- club expenses that are not tied to one camp (rent, printing, events, help to patients)
create sequence if not exists club_expenses_voucher_no_seq;
create table if not exists club_expenses(
  id uuid primary key default gen_random_uuid(),
  voucher_no int not null unique,
  spent_on date not null default current_date, category text not null default 'Other'
    check (category in ('Printing and stationery','Event and meeting','Travel','Medical help','Awareness drive','Rent and hall','Gifts and mementos','Bank charges','Other')),
  paid_to text not null, description text, amount numeric(12,2) not null,
  mode text not null default 'Cash' check (mode in ('Cash','UPI','Bank transfer','Cheque','Card')), reference text, approved_by text,
  status text not null default 'paid' check (status in ('paid','cancelled')), cancel_reason text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now());
alter table club_expenses enable row level security;
create policy "club expenses manage" on club_expenses for all using (perm('funds')) with check (perm('funds'));

create or replace function validate_funds_row() returns trigger language plpgsql set search_path=public as $$
begin
  if tg_table_name='contributions' then
    if length(trim(coalesce(new.donor_name,'')))<2 then raise exception 'Enter the name of the person or company who gave'; end if;
    if new.amount is null or new.amount<=0 then raise exception 'Amount must be more than 0'; end if;
    if new.amount>10000000 then raise exception 'Check the amount'; end if;
    if coalesce(new.phone,'')<>'' and new.phone !~ '^[6-9][0-9]{9}$' then raise exception 'Mobile number must be 10 digits'; end if;
    if coalesce(new.email,'')<>'' and new.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email or leave it empty'; end if;
    if new.received_on > current_date then raise exception 'Received date cannot be in the future'; end if;
    if new.mode in ('UPI','Bank transfer','Cheque') and coalesce(trim(new.reference),'')='' then raise exception 'Enter the UPI, bank or cheque reference number'; end if;
    if new.status='cancelled' and coalesce(trim(new.cancel_reason),'')='' then raise exception 'Say why the receipt is cancelled'; end if;
    if tg_op='UPDATE' and old.status='cancelled' and new.status='received' then raise exception 'A cancelled receipt cannot be used again. Make a new receipt.'; end if;
    new.donor_name := trim(new.donor_name);
    if tg_op='INSERT' then new.receipt_no := coalesce(new.receipt_no,nextval('contributions_receipt_no_seq')); end if;
  elsif tg_table_name='club_expenses' then
    if length(trim(coalesce(new.paid_to,'')))<2 then raise exception 'Enter who was paid'; end if;
    if new.amount is null or new.amount<=0 then raise exception 'Amount must be more than 0'; end if;
    if new.spent_on > current_date then raise exception 'Date cannot be in the future'; end if;
    if new.status='cancelled' and coalesce(trim(new.cancel_reason),'')='' then raise exception 'Say why the voucher is cancelled'; end if;
    if tg_op='INSERT' then new.voucher_no := coalesce(new.voucher_no,nextval('club_expenses_voucher_no_seq')); end if;
  end if;
  return new; end $$;

do $$ declare t text; begin
  foreach t in array array['contributions','club_expenses'] loop
    execute format('create or replace trigger validate_%1$s before insert or update on %1$I for each row execute function validate_funds_row()', t);
    execute format('create or replace trigger audit_%1$s after insert or update or delete on %1$I for each row execute function audit_row()', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    if exists(select 1 from pg_publication where pubname='supabase_realtime')
       and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table %I', t); end if;
  end loop; end $$;
grant usage, select on sequence contributions_receipt_no_seq, club_expenses_voucher_no_seq to authenticated;
revoke execute on function validate_funds_row() from public, anon, authenticated;

-- money in and out for a period, for the accounts statement
create or replace function funds_summary(p_from date, p_to date) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not perm('funds') then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'donations',(select coalesce(sum(amount),0) from contributions where status='received' and received_on between p_from and p_to),
    'donation_count',(select count(*) from contributions where status='received' and received_on between p_from and p_to),
    'dues',(select coalesce(sum(amount),0) from member_dues where paid_on between p_from and p_to),
    'sponsors',(select coalesce(sum(s.amount),0) from sponsors s join camps c on c.id=s.camp_id where s.received and c.camp_date between p_from and p_to and c.deleted_at is null),
    'camp_expenses',(select coalesce(sum(e.amount),0) from expenses e join camps c on c.id=e.camp_id where e.spent_on between p_from and p_to and c.deleted_at is null),
    'club_expenses',(select coalesce(sum(amount),0) from club_expenses where status='paid' and spent_on between p_from and p_to),
    'by_purpose',coalesce((select jsonb_agg(jsonb_build_object('purpose',purpose,'amount',a,'count',n) order by a desc) from (select purpose,sum(amount) a,count(*) n from contributions where status='received' and received_on between p_from and p_to group by 1) x),'[]'::jsonb),
    'by_mode',coalesce((select jsonb_agg(jsonb_build_object('mode',mode,'amount',a) order by a desc) from (select mode,sum(amount) a from (
        select mode,amount from contributions where status='received' and received_on between p_from and p_to
        union all select mode,amount from member_dues where paid_on between p_from and p_to) z group by 1) x),'[]'::jsonb),
    'expense_by_category',coalesce((select jsonb_agg(jsonb_build_object('category',category,'amount',a) order by a desc) from (select category,sum(amount) a from (
        select category,amount from club_expenses where status='paid' and spent_on between p_from and p_to
        union all select 'Camp: '||e.category,e.amount from expenses e join camps c on c.id=e.camp_id where e.spent_on between p_from and p_to and c.deleted_at is null) z group by 1) x),'[]'::jsonb),
    'monthly',coalesce((select jsonb_agg(jsonb_build_object('month',m,'in',coalesce(i,0),'out',coalesce(o,0)) order by m) from (
        select m, sum(i) i, sum(o) o from (
          select to_char(received_on,'YYYY-MM') m, amount i, 0 o from contributions where status='received' and received_on between p_from and p_to
          union all select to_char(paid_on,'YYYY-MM'), amount, 0 from member_dues where paid_on between p_from and p_to
          union all select to_char(c.camp_date,'YYYY-MM'), s.amount, 0 from sponsors s join camps c on c.id=s.camp_id where s.received and c.camp_date between p_from and p_to and c.deleted_at is null
          union all select to_char(spent_on,'YYYY-MM'), 0, amount from club_expenses where status='paid' and spent_on between p_from and p_to
          union all select to_char(e.spent_on,'YYYY-MM'), 0, e.amount from expenses e join camps c on c.id=e.camp_id where e.spent_on between p_from and p_to and c.deleted_at is null) z group by m) x),'[]'::jsonb));
end $$;
revoke execute on function funds_summary(date,date) from public, anon;
grant execute on function funds_summary(date,date) to authenticated;

-- undo engine also understands the new tables (only matters once v4e-undo-engine.sql has been run)
