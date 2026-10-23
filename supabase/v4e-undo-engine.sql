-- Paste this in Supabase SQL Editor and Run once (the undo engine). Safe to run again.
-- Reverses every change made in one transaction (one save, delete or camp-day step).
create or replace function _revert_tx(p_txid bigint) returns int language plpgsql security definer set search_path=public as $$
declare r record; pk text; cols text; n int := 0;
  rank jsonb := '{"profiles":0,"camps":1,"donors":1,"handovers":1,"registrations":2,"screenings":3,"donations":3,"blood_units":4,"members":1,"meetings":1,"pledges":1}';
begin
  if exists(select 1 from audit_logs where txid=p_txid and reverted_at is null and table_name not in
     ('donors','camps','registrations','screenings','donations','blood_units','handovers','emergency_requests','tasks','camp_volunteers','sponsors','expenses',
      'settings','message_templates','stock_thresholds','profiles',
      'members','member_dues','meetings','meeting_actions','pledges','afterlife_cases','donor_events','contributions','club_expenses')) then raise exception 'This change cannot be undone'; end if;
  if exists(select 1 from audit_logs where txid=p_txid and reverted_at is null and table_name in ('profiles','settings') and action<>'update') then
    raise exception 'Adding or removing users and settings cannot be undone here'; end if;
  perform set_config('app.reverting','1',true);
  -- refuse when a later change touched the same record
  if exists(select 1 from audit_logs e join audit_logs l on l.table_name=e.table_name and l.row_id=e.row_id and l.id>e.id and l.txid<>e.txid and l.reverted_at is null and not l.is_revert
            where e.txid=p_txid and e.reverted_at is null
              and (l.action='delete' or e.action<>'update' or (l.changes ?| array(select jsonb_object_keys(e.changes)))))
  then raise exception 'This record was changed again later. Undo the later change first.'; end if;
  -- 1. put deleted rows back, parents first
  for r in select * from audit_logs where txid=p_txid and reverted_at is null and action='delete' order by coalesce((rank->>table_name)::int,5), id loop
    execute format('insert into %I select * from jsonb_populate_record(null::%I, $1)', r.table_name, r.table_name) using r.snapshot; n:=n+1;
  end loop;
  -- 2. set changed columns back to their old values, newest first
  for r in select * from audit_logs where txid=p_txid and reverted_at is null and action='update' order by id desc loop
    pk := _pk(r.table_name);
    select string_agg(quote_ident(k),',') into cols from jsonb_object_keys(r.changes) k where k not in ('id','created_at','donor_no','camp_no','member_no','req_no','token_no','cert_no','handover_no','sponsor_no','expense_no','volunteer_no','member_no','receipt_no','meeting_no','action_no','pledge_no','case_no','event_no','verify_code','voucher_no');
    if cols is null then continue; end if;
    execute format('update %I set (%s) = (select %s from jsonb_populate_record(null::%I, $1)) where %I::text = $2', r.table_name, cols, cols, r.table_name, pk)
      using r.snapshot, r.snapshot->>pk; n:=n+1;
  end loop;
  -- 3. remove rows that were added, children first
  for r in select * from audit_logs where txid=p_txid and reverted_at is null and action='insert' order by coalesce((rank->>table_name)::int,5) desc, id desc loop
    pk := _pk(r.table_name);
    execute format('delete from %I where %I::text = $1', r.table_name, pk) using r.snapshot->>pk; n:=n+1;
  end loop;
  update audit_logs set reverted_at=now(), reverted_by=auth.uid() where txid=p_txid and reverted_at is null;
  perform set_config('app.reverting','',true);
  return n; end $$;

revoke execute on function _revert_tx(bigint) from public, anon, authenticated;
