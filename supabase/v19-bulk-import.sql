-- v19: bulk import for every module (Excel / CSV), with a full preview before anything is saved,
-- duplicate checks on 2-3 unique fields, and a revert that undoes exactly what an import changed. Run once, after v18.

alter table donors add column if not exists address text;

-- ======================= what each module accepts =======================
-- cols: columns a file may fill. keys: ways to recognise a record that is already in the CRM (any one set is enough).
-- code: the ID shown in the CRM (D-0001 ...), used to match and in messages. refs: columns that point at another record.
create or replace function import_spec(p_entity text) returns jsonb language sql immutable as $$
  select case p_entity
  when 'donors' then '{"table":"donors","label":"Donors","perms":["donors"],"pk":["id"],"soft":true,
     "cols":["full_name","phone","email","blood_group","gender","dob","address","area","last_donation","consent","donor_no"],
     "required":["full_name","phone"],"keys":[["donor_no"],["phone"],["email"]],"code":{"col":"donor_no","p":"D","w":4,"seq":"donor_no_seq"},"name":"full_name"}'::jsonb
  when 'members' then '{"table":"members","label":"Members","perms":["members"],"pk":["id"],"soft":true,
     "cols":["member_no","full_name","phone","email","dob","gender","blood_group","address","area","occupation","organisation","position","membership_type","status","joined_on","left_on","ri_member_id","emergency_contact","notes"],
     "required":["full_name"],"keys":[["member_no"],["phone"],["email"],["ri_member_id"]],"code":{"col":"member_no","p":"M","w":3,"seq":"members_member_no_seq"},"name":"full_name"}'::jsonb
  when 'member_dues' then '{"table":"member_dues","label":"Member payments","perms":["members"],"pk":["id"],"soft":false,
     "cols":["receipt_no","member_id","period","paid_on","subscription","donation","mode","reference","notes"],
     "required":["member_id"],"refs":{"member_ref":"member_id"},"keys":[["receipt_no"],["member_id","paid_on","subscription"]],
     "code":{"col":"receipt_no","p":"RC","w":4,"seq":"member_dues_receipt_no_seq"},"name":"period"}'::jsonb
  when 'donor_events' then '{"table":"donor_events","label":"Past blood donations","perms":["donors"],"pk":["id"],"soft":false,
     "cols":["donor_id","event_date","kind","place","units","notes"],
     "required":["donor_id","event_date"],"refs":{"donor_ref":"donor_id"},"keys":[["donor_id","event_date","kind"]],
     "code":{"col":"event_no","p":"DE","w":4,"seq":"donor_events_no_seq"},"name":"place","defaults":{"kind":"outside_donation","units":1}}'::jsonb
  when 'camps' then '{"table":"camps","label":"Camps","perms":["camps"],"pk":["id"],"soft":true,
     "cols":["camp_no","name","camp_type","camp_type_other","camp_date","start_time","end_time","venue","target_donors","slot_capacity","status","budget","beneficiaries","about"],
     "required":["name","camp_date"],"keys":[["camp_no"],["name","camp_date"]],"code":{"col":"camp_no","p":"C","w":3,"seq":"camp_no_seq"},"name":"name",
     "defaults":{"start_time":"09:00","end_time":"15:00","status":"completed","camp_type":"Blood donation"}}'::jsonb
  when 'camp_attendance' then '{"table":"camp_attendance","label":"Camp attendance","perms":["camps","members"],"pk":["camp_id","member_id"],"soft":false,
     "cols":["camp_id","member_id","status","late_minutes","duty"],"required":["camp_id","member_id"],"refs":{"camp_ref":"camp_id","member_ref":"member_id"},
     "keys":[["camp_id","member_id"]],"name":"status","defaults":{"status":"present"}}'::jsonb
  when 'meetings' then '{"table":"meetings","label":"Meetings","perms":["meetings"],"pk":["id"],"soft":true,
     "cols":["meeting_no","kind","kind_other","audience","title","meeting_date","start_time","end_time","venue","mode","online_link","chaired_by","minutes_by","chief_guest","guests","guest_names","agenda","minutes","decisions","status"],
     "required":["title","meeting_date"],"keys":[["meeting_no"],["title","meeting_date"]],"code":{"col":"meeting_no","p":"MT","w":3,"seq":"meetings_meeting_no_seq"},"name":"title",
     "defaults":{"status":"held","kind":"Weekly"}}'::jsonb
  when 'meeting_attendance' then '{"table":"meeting_attendance","label":"Meeting attendance","perms":["meetings"],"pk":["meeting_id","member_id"],"soft":false,
     "cols":["meeting_id","member_id","status","late_minutes","note"],"required":["meeting_id","member_id"],"refs":{"meeting_ref":"meeting_id","member_ref":"member_id"},
     "keys":[["meeting_id","member_id"]],"name":"status","defaults":{"status":"present"}}'::jsonb
  when 'hospitals' then '{"table":"hospitals","label":"Hospitals and blood banks","perms":["emergency","camps","afterlife"],"pk":["id"],"soft":true,
     "cols":["name","kind","city","address","phone","phone2","contact_person","email","open_24x7","tie_up","blood_groups_note","notes"],
     "required":["name"],"keys":[["name","city"],["phone"]],"name":"name"}'::jsonb
  when 'projects' then '{"table":"projects","label":"Service projects","perms":["members"],"pk":["id"],"soft":true,
     "cols":["project_no","title","avenue","status","start_date","end_date","venue","partner","beneficiaries","budget","spent","description","outcome"],
     "required":["title"],"keys":[["project_no"],["title","start_date"]],"code":{"col":"project_no","p":"P","w":3,"seq":"projects_no_seq"},"name":"title"}'::jsonb
  when 'events' then '{"table":"events","label":"Club events","perms":["meetings","members"],"pk":["id"],"soft":true,
     "cols":["event_no","title","kind","event_date","start_time","end_time","venue","capacity","open_registration","fee","description","status"],
     "required":["title","event_date"],"keys":[["event_no"],["title","event_date"]],"code":{"col":"event_no","p":"E","w":3,"seq":"events_no_seq"},"name":"title"}'::jsonb
  end $$;

-- ======================= log of every import =======================
create table if not exists import_batches(
  id uuid primary key default gen_random_uuid(),
  batch_no serial,
  entity text not null, file_name text, mode text not null check (mode in ('add','update')),
  total int not null default 0, inserted int not null default 0, updated int not null default 0, skipped int not null default 0, failed int not null default 0,
  status text not null default 'applied' check (status in ('applied','reverted','partly_reverted')),
  created_by uuid default auth.uid(), created_by_name text, created_at timestamptz not null default now(),
  reverted_at timestamptz, reverted_by uuid, revert_report jsonb);
create table if not exists import_changes(
  id bigserial primary key,
  batch_id uuid not null references import_batches on delete cascade,
  line int, tbl text not null, pk jsonb not null, action text not null check (action in ('insert','update')),
  before jsonb, after jsonb);
create index if not exists import_changes_batch on import_changes(batch_id, id);
alter table import_batches enable row level security;
alter table import_changes enable row level security;
drop policy if exists "import batches read" on import_batches;
create policy "import batches read" on import_batches for select using (
  perm('import') or perm('settings') or exists(select 1 from jsonb_array_elements_text(import_spec(entity)->'perms') p where perm(p)));
grant select on import_batches to authenticated;
do $$ begin if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='import_batches') then
  alter publication supabase_realtime add table import_batches; end if; end $$;

create or replace function import_allowed(p_entity text) returns boolean language sql stable security definer set search_path=public as $$
  select import_spec(p_entity) is not null and exists(select 1 from jsonb_array_elements_text(import_spec(p_entity)->'perms') p where perm(p)) $$;

-- the record another column points at: M-0003 / mobile / email / exact name; D-0012 ...; MT-005 or a date; C-004 or a date or name
create or replace function import_ref(p_kind text, p_value text) returns uuid language plpgsql stable security definer set search_path=public as $$
declare s text := trim(coalesce(p_value,'')); dg text := regexp_replace(coalesce(p_value,''),'\D','','g'); ids uuid[]; what text; begin
  if s='' then return null; end if;
  if p_kind='member_ref' then what:='member';
    if s ~* '^m\s*-?\s*\d{1,6}$' or s ~ '^\d{1,6}$' then select array_agg(id) into ids from members where deleted_at is null and member_no=dg::int;
    elsif length(dg)>=10 then select array_agg(id) into ids from members where deleted_at is null and phone=right(dg,10);
    elsif s like '%@%' then select array_agg(id) into ids from members where deleted_at is null and lower(email)=lower(s);
    else select array_agg(id) into ids from members where deleted_at is null and lower(full_name)=lower(s); end if;
  elsif p_kind='donor_ref' then what:='donor';
    if s ~* '^d\s*-?\s*\d{1,7}$' or s ~ '^\d{1,7}$' then select array_agg(id) into ids from donors where deleted_at is null and donor_no=dg::int;
    elsif length(dg)>=10 then select array_agg(id) into ids from donors where deleted_at is null and phone=right(dg,10);
    elsif s like '%@%' then select array_agg(id) into ids from donors where deleted_at is null and lower(email)=lower(s);
    else select array_agg(id) into ids from donors where deleted_at is null and lower(full_name)=lower(s); end if;
  elsif p_kind='meeting_ref' then what:='meeting';
    if s ~* '^mt\s*-?\s*\d{1,6}$' or s ~ '^\d{1,6}$' then select array_agg(id) into ids from meetings where deleted_at is null and meeting_no=dg::int;
    elsif s ~ '^\d{4}-\d{2}-\d{2}$' then select array_agg(id) into ids from meetings where deleted_at is null and meeting_date=s::date;
    else select array_agg(id) into ids from meetings where deleted_at is null and lower(title)=lower(s); end if;
  elsif p_kind='camp_ref' then what:='camp';
    if s ~* '^c\s*-?\s*\d{1,6}$' or s ~ '^\d{1,6}$' then select array_agg(id) into ids from camps where deleted_at is null and camp_no=dg::int;
    elsif s ~ '^\d{4}-\d{2}-\d{2}$' then select array_agg(id) into ids from camps where deleted_at is null and camp_date=s::date;
    else select array_agg(id) into ids from camps where deleted_at is null and lower(name)=lower(s); end if;
  else raise exception 'Unknown link %', p_kind; end if;
  if coalesce(array_length(ids,1),0)=0 then raise exception 'No % found for "%"', what, s; end if;
  if array_length(ids,1)>1 then raise exception 'More than one % matches "%". Use the ID instead.', what, s; end if;
  return ids[1]; end $$;
revoke execute on function import_ref(text,text) from public, anon;

create or replace function import_code(sp jsonb, r jsonb) returns text language sql immutable as $$
  select case when sp->'code' is not null and (r->>(sp->'code'->>'col')) is not null
    then (sp->'code'->>'p')||'-'||lpad(r->>(sp->'code'->>'col'),(sp->'code'->>'w')::int,'0') end $$;

-- friendly words for database errors
create or replace function import_err(p_state text, p_msg text) returns text language sql immutable as $$
  select case
    when p_state='23505' and p_msg ilike '%phone%' then 'This mobile number is already used by another record (it may be in the Recycle bin)'
    when p_state='23505' then 'This is already in the CRM (same unique value)'
    when p_state='23514' then 'A value is not one of the allowed choices: '||coalesce(substring(p_msg from 'constraint "([^"]+)"'),p_msg)
    when p_state='22P02' or p_state='22007' or p_state='22008' then 'A date, time or number is not in a readable format'
    when p_state='23502' then 'A required value is missing: '||coalesce(substring(p_msg from 'column "([^"]+)"'),'')
    else p_msg end $$;


-- ======================= run an import (or only preview it) =======================
-- p_rows: [{column: value, ...}] already tidied by the screen (dates YYYY-MM-DD, times HH:MM, yes/no as true/false).
-- p_dry=true does everything for real and then rolls it all back, so the preview shows exactly what will happen.
-- Each result row: {line, action: insert|update|same|skip|error, code, name, by:[columns that matched], changed:[columns], reason, msg}
create or replace function import_run(p_entity text, p_file text, p_mode text, p_rows jsonb, p_dry boolean default true) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  sp jsonb := import_spec(p_entity); tbl text; pkcols text[]; codecol text; coltypes jsonb; batch uuid;
  res jsonb := '[]'; item jsonb; r jsonb; n jsonb; cur jsonb; newrow jsonb; one jsonb;
  i int := 0; k text; c text; ks jsonb; conds text[]; where_pk text; found_rows jsonb; fr jsonb; matched jsonb; pkstr text;
  changed text[]; seen jsonb := '{}'; keystr text; dup int; missing text[];
  cnt jsonb := '{"insert":0,"update":0,"same":0,"skip":0,"error":0}';
  seq text; seq_last bigint; seq_called boolean; mx bigint; err_state text; err_msg text; d_before date; d_after date;
begin
  if sp is null then raise exception 'Unknown import type'; end if;
  if not import_allowed(p_entity) then raise exception 'You do not have permission to import %', sp->>'label'; end if;
  if p_mode not in ('add','update') then raise exception 'Choose add or update'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 then raise exception 'The file has no rows'; end if;
  if jsonb_array_length(p_rows)>5000 then raise exception 'Import up to 5000 rows at a time. Split the file and import in parts.'; end if;
  tbl := sp->>'table'; codecol := sp->'code'->>'col'; seq := sp->'code'->>'seq';
  select array_agg(x) into pkcols from jsonb_array_elements_text(sp->'pk') x;
  select jsonb_object_agg(column_name,data_type) into coltypes from information_schema.columns where table_schema='public' and table_name=tbl;
  where_pk := array_to_string(array(select format('t.%I=($2->>%L)::uuid',pc,pc) from unnest(pkcols) pc),' and ');
  if p_dry and seq is not null and to_regclass(seq) is not null then execute format('select last_value, is_called from %I',seq) into seq_last, seq_called; end if;

  begin   -- a preview undoes everything in here at the end
    if not p_dry then
      insert into import_batches(entity,file_name,mode,total,created_by_name)
        values(p_entity,left(coalesce(p_file,''),200),p_mode,jsonb_array_length(p_rows),(select full_name from profiles where id=auth.uid())) returning id into batch; end if;

    for item in select value from jsonb_array_elements(p_rows) loop
      i := i+1; one := jsonb_build_object('line',i);
      begin
        -- 1. only this module's columns; empty cells are left out; links become the record they point at
        r := '{}';
        for k in select jsonb_object_keys(item) loop
          if jsonb_typeof(item->k)='null' or trim(item->>k)='' then continue; end if;
          if sp->'refs' ? k then r := r || jsonb_build_object(sp->'refs'->>k, import_ref(k,item->>k));
          elsif sp->'cols' ? k then r := r || jsonb_build_object(k, case when jsonb_typeof(item->k)='string' then to_jsonb(trim(item->>k)) else item->k end); end if;
        end loop;
        if r='{}' then one := one||'{"action":"skip","reason":"empty"}'; res := res||one; cnt := jsonb_set(cnt,'{skip}',to_jsonb((cnt->>'skip')::int+1)); continue; end if;
        if codecol is not null and r ? codecol then
          if regexp_replace(r->>codecol,'\D','','g')='' then r := r - codecol; else r := jsonb_set(r,array[codecol],to_jsonb(regexp_replace(r->>codecol,'\D','','g')::bigint)); end if; end if;
        if r ? 'phone' then r := jsonb_set(r,'{phone}',to_jsonb(case when length(regexp_replace(r->>'phone','\D','','g'))>10 then right(regexp_replace(r->>'phone','\D','','g'),10) else regexp_replace(r->>'phone','\D','','g') end)); end if;
        if r ? 'email' then r := jsonb_set(r,'{email}',to_jsonb(lower(r->>'email'))); end if;
        one := one || jsonb_build_object('name',coalesce(r->>(sp->>'name'),''));

        -- 2. the same record twice in this file?
        dup := null;
        for ks in select value from jsonb_array_elements(sp->'keys') loop
          if exists(select 1 from jsonb_array_elements_text(ks) x where not r ? x) then continue; end if;
          select string_agg(x||'='||lower(r->>x),'|' order by x) into keystr from jsonb_array_elements_text(ks) x;
          if seen ? keystr then dup := (seen->>keystr)::int; one := one||jsonb_build_object('by',ks); exit; end if;
          seen := seen || jsonb_build_object(keystr,i);
        end loop;
        if dup is not null then one := one||jsonb_build_object('action','skip','reason','dup_in_file','dup_line',dup); res := res||one; cnt := jsonb_set(cnt,'{skip}',to_jsonb((cnt->>'skip')::int+1)); continue; end if;

        -- 3. already in the CRM? try every unique field set
        matched := '{}';
        for ks in select value from jsonb_array_elements(sp->'keys') loop
          if exists(select 1 from jsonb_array_elements_text(ks) x where not r ? x) then continue; end if;
          select array_agg(case when coltypes->>x='text' then format('lower(trim(t.%I))=lower(trim(n.%I))',x,x) else format('t.%I=n.%I',x,x) end) into conds
            from jsonb_array_elements_text(ks) x;
          execute format('select coalesce(jsonb_agg(to_jsonb(t)),''[]'') from %I t, jsonb_populate_record(null::%I,$1) n where %s %s',
            tbl,tbl,array_to_string(conds,' and '),case when (sp->>'soft')::boolean then 'and t.deleted_at is null' else '' end) using r into found_rows;
          for fr in select value from jsonb_array_elements(found_rows) loop
            select string_agg(fr->>pc,'|') into pkstr from unnest(pkcols) pc;
            matched := jsonb_set(matched,array[pkstr],jsonb_build_object('row',fr,'by',coalesce(matched->pkstr->'by','[]')||jsonb_build_array(ks)));
          end loop;
        end loop;

        if (select count(*) from jsonb_object_keys(matched))>1 then
          one := one||jsonb_build_object('action','skip','reason','many',
            'matches',(select jsonb_agg(jsonb_build_object('code',import_code(sp,v->'row'),'name',v->'row'->>(sp->>'name'),'by',v->'by'->0)) from jsonb_each(matched) e(kk,v)));
          res := res||one; cnt := jsonb_set(cnt,'{skip}',to_jsonb((cnt->>'skip')::int+1)); continue; end if;
        if codecol is not null and r ? codecol and matched='{}' then
          one := one||jsonb_build_object('action','error','reason','code_not_found','code',(sp->'code'->>'p')||'-'||lpad(r->>codecol,(sp->'code'->>'w')::int,'0'));
          res := res||one; cnt := jsonb_set(cnt,'{error}',to_jsonb((cnt->>'error')::int+1)); continue; end if;

        if matched<>'{}' then
          select v->'row', v->'by'->0 into cur, ks from jsonb_each(matched) e(kk,v) limit 1;
          one := one||jsonb_build_object('code',import_code(sp,cur),'by',ks,'match_name',coalesce(cur->>(sp->>'name'),''));
          if p_mode='add' then one := one||'{"action":"skip","reason":"exists"}'; res := res||one; cnt := jsonb_set(cnt,'{skip}',to_jsonb((cnt->>'skip')::int+1)); continue; end if;
          -- 4a. update only the cells that differ
          execute format('select to_jsonb(jsonb_populate_record(null::%I,$1))',tbl) using r into n;
          select array_agg(x) into changed from jsonb_object_keys(r) x where x<>all(pkcols) and x is distinct from codecol and (n->x) is distinct from (cur->x);
          if changed is null then one := one||'{"action":"same"}'; res := res||one; cnt := jsonb_set(cnt,'{same}',to_jsonb((cnt->>'same')::int+1)); continue; end if;
          execute format('update %I t set (%s) = (select %s from jsonb_populate_record(null::%I,$1)) where %s returning to_jsonb(t)',
            tbl, array_to_string(array(select quote_ident(x) from unnest(changed) x),','), array_to_string(array(select quote_ident(x) from unnest(changed) x),','), tbl, where_pk)
            using r, cur into newrow;
          if not p_dry then insert into import_changes(batch_id,line,tbl,pk,action,before,after) values(batch,i,tbl,
            (select jsonb_object_agg(pc,cur->pc) from unnest(pkcols) pc),'update',
            (select jsonb_object_agg(x,cur->x) from unnest(changed) x),(select jsonb_object_agg(x,newrow->x) from unnest(changed) x)); end if;
          one := one||jsonb_build_object('action','update','changed',to_jsonb(changed));
          cnt := jsonb_set(cnt,'{update}',to_jsonb((cnt->>'update')::int+1));
        else
          -- 4b. new record
          if codecol is not null then r := r - codecol; end if;
          r := coalesce(sp->'defaults','{}') || r;
          if p_entity='donors' and not r ? 'consent' then r := r||'{"consent":false}'; end if;
          if p_entity='donors' then r := r||jsonb_build_object('source',left('import: '||coalesce(p_file,''),120)); end if;
          select array_agg(x) into missing from jsonb_array_elements_text(sp->'required') x where not r ? x;
          if missing is not null then one := one||jsonb_build_object('action','error','reason','missing','changed',to_jsonb(missing)); res := res||one; cnt := jsonb_set(cnt,'{error}',to_jsonb((cnt->>'error')::int+1)); continue; end if;
          if p_entity='donor_events' then select last_donation into d_before from donors where id=(r->>'donor_id')::uuid; end if;
          execute format('insert into %I (%s) select %s from jsonb_populate_record(null::%I,$1) returning to_jsonb(%I.*)',
            tbl, array_to_string(array(select quote_ident(x) from jsonb_object_keys(r) x),','), array_to_string(array(select quote_ident(x) from jsonb_object_keys(r) x),','), tbl, tbl)
            using r into newrow;
          if not p_dry then insert into import_changes(batch_id,line,tbl,pk,action,before,after) values(batch,i,tbl,
            (select jsonb_object_agg(pc,newrow->pc) from unnest(pkcols) pc),'insert',null,newrow); end if;
          -- a past donation also moves the donor's last donation date: log it so a revert puts it back
          if p_entity='donor_events' then select last_donation into d_after from donors where id=(r->>'donor_id')::uuid;
            if d_after is distinct from d_before and not p_dry then insert into import_changes(batch_id,line,tbl,pk,action,before,after)
              values(batch,i,'donors',jsonb_build_object('id',r->>'donor_id'),'update',jsonb_build_object('last_donation',d_before),jsonb_build_object('last_donation',d_after)); end if; end if;
          one := one||jsonb_build_object('action','insert','code',import_code(sp,newrow));
          cnt := jsonb_set(cnt,'{insert}',to_jsonb((cnt->>'insert')::int+1));
        end if;
      exception when others then
        get stacked diagnostics err_state = returned_sqlstate, err_msg = message_text;
        one := one||jsonb_build_object('action','error','msg',import_err(err_state,err_msg));
        cnt := jsonb_set(cnt,'{error}',to_jsonb((cnt->>'error')::int+1));
      end;
      if not (one ? 'action') then one := one||'{"action":"error","msg":"Unknown"}'; end if;
      res := res||one;
    end loop;

    if not p_dry then
      update import_batches set inserted=(cnt->>'insert')::int, updated=(cnt->>'update')::int, skipped=(cnt->>'skip')::int+(cnt->>'same')::int, failed=(cnt->>'error')::int where id=batch;
      if (cnt->>'insert')::int+(cnt->>'update')::int=0 then delete from import_batches where id=batch; batch := null; end if;
    else raise exception using errcode='P0003', message='__preview__'; end if;
  exception when sqlstate 'P0003' then null;   -- preview: everything above is rolled back
  end;

  -- a preview used up ID numbers; give them back (never below what is really in the table)
  if p_dry and seq_last is not null then
    execute format('select coalesce(max(%I),0) from %I',codecol,tbl) into mx;
    if greatest(seq_last,mx)>=1 then perform setval(seq, greatest(seq_last,mx), seq_called or mx>seq_last); end if; end if;
  return jsonb_build_object('batch',batch,'dry',p_dry,'counts',cnt,'rows',res); end $$;
grant execute on function import_run(text,text,text,jsonb,boolean) to authenticated;
revoke execute on function import_run(text,text,text,jsonb,boolean) from public, anon;

-- ======================= undo an import =======================
-- Puts back exactly what the import changed. Anything that was edited again after the import is left alone and listed,
-- so nothing ends up half-changed. p_dry=true only shows what would happen.
create or replace function import_revert(p_batch uuid, p_dry boolean default true) returns jsonb language plpgsql security definer set search_path=public as $$
declare b import_batches; sp jsonb; ch import_changes; cur jsonb; where_pk text; restore jsonb; diff text[]; out jsonb := '[]';
  nd int := 0; nr int := 0; nc int := 0; ngone int := 0; err_state text; err_msg text; codetxt text; begin
  select * into b from import_batches where id=p_batch;
  if b.id is null then raise exception 'Import not found'; end if;
  if not import_allowed(b.entity) then raise exception 'You do not have permission to undo this import'; end if;
  if b.status<>'applied' then raise exception 'This import was already undone'; end if;
  sp := import_spec(b.entity);
  begin
    for ch in select * from import_changes where batch_id=p_batch order by id desc loop
      where_pk := array_to_string(array(select format('t.%I=($1->>%L)::uuid',k,k) from jsonb_object_keys(ch.pk) k),' and ');
      execute format('select to_jsonb(t) from %I t where %s',ch.tbl,where_pk) using ch.pk into cur;
      codetxt := case when ch.tbl=sp->>'table' then import_code(sp,coalesce(cur,ch.after)) end;
      begin
        if cur is null then ngone := ngone+1; out := out||jsonb_build_object('line',ch.line,'tbl',ch.tbl,'code',codetxt,'action','gone'); continue; end if;
        if ch.action='insert' then
          -- anything edited after the import (other than automatic stamps) means someone worked on it: keep it
          select array_agg(k) into diff from jsonb_object_keys(ch.after) k where k <> all(array['updated_at','consent_at','noted_at']) and (cur->k) is distinct from (ch.after->k);
          if diff is not null then nc := nc+1; out := out||jsonb_build_object('line',ch.line,'tbl',ch.tbl,'code',codetxt,'action','kept','reason','edited','fields',to_jsonb(diff),'name',cur->>(sp->>'name')); continue; end if;
          if ch.tbl='members' then delete from board_terms where member_id=(ch.pk->>'id')::uuid; end if;
          if ch.tbl='member_dues' then delete from app_alerts where ref='dues:'||(ch.pk->>'id'); end if;
          execute format('delete from %I t where %s',ch.tbl,where_pk) using ch.pk;
          nd := nd+1; out := out||jsonb_build_object('line',ch.line,'tbl',ch.tbl,'code',codetxt,'action','removed','name',cur->>(sp->>'name'));
        else
          select array_agg(k) into diff from jsonb_object_keys(ch.after) k where (cur->k) is distinct from (ch.after->k);
          select jsonb_object_agg(k,ch.before->k) into restore from jsonb_object_keys(ch.after) k where (cur->k) is not distinct from (ch.after->k);
          if restore is not null then
            execute format('update %I t set (%s) = (select %s from jsonb_populate_record(null::%I,$2)) where %s',ch.tbl,
              array_to_string(array(select quote_ident(k) from jsonb_object_keys(restore) k),','),array_to_string(array(select quote_ident(k) from jsonb_object_keys(restore) k),','),ch.tbl,where_pk)
              using ch.pk, restore;
            nr := nr+1; end if;
          if diff is not null then nc := nc+1; end if;
          out := out||jsonb_build_object('line',ch.line,'tbl',ch.tbl,'code',codetxt,'action',case when diff is null then 'restored' when restore is null then 'kept' else 'partly' end,
            'fields',(select to_jsonb(array_agg(k)) from jsonb_object_keys(coalesce(restore,'{}')) k),'kept_fields',to_jsonb(diff),'reason',case when diff is not null then 'edited' end,'name',cur->>(sp->>'name'));
        end if;
      exception when others then
        get stacked diagnostics err_state = returned_sqlstate, err_msg = message_text;
        nc := nc+1; out := out||jsonb_build_object('line',ch.line,'tbl',ch.tbl,'code',codetxt,'action','kept','reason',case when err_state='23503' then 'in_use' else 'error' end,'msg',err_msg,'name',cur->>(sp->>'name'));
      end;
    end loop;
    if not p_dry then
      update import_batches set status=case when nc=0 then 'reverted' else 'partly_reverted' end, reverted_at=now(), reverted_by=auth.uid(),
        revert_report=jsonb_build_object('removed',nd,'restored',nr,'kept',nc,'gone',ngone) where id=p_batch;
    else raise exception using errcode='P0003', message='__preview__'; end if;
  exception when sqlstate 'P0003' then null;
  end;
  return jsonb_build_object('dry',p_dry,'removed',nd,'restored',nr,'kept',nc,'gone',ngone,'rows',out); end $$;
grant execute on function import_revert(uuid,boolean) to authenticated;
revoke execute on function import_revert(uuid,boolean) from public, anon;

-- very late self check-ins (meeting with no end time) never break the 0-600 minute rule
create or replace function clamp_late_minutes() returns trigger language plpgsql as $$
begin if new.late_minutes is not null then new.late_minutes := least(greatest(new.late_minutes,0),600); end if; return new; end $$;
drop trigger if exists clamp_late on meeting_attendance;
create trigger clamp_late before insert or update on meeting_attendance for each row execute function clamp_late_minutes();
drop trigger if exists clamp_late on camp_attendance;
create trigger clamp_late before insert or update on camp_attendance for each row execute function clamp_late_minutes();
