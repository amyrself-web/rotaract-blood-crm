-- v8: member ID cards (photo, card check code, public verify), donor card dates, camp materials. Run once, after v7.

-- ---------- member photos and ID card code ----------
alter table members add column if not exists photo_url text;
alter table members add column if not exists card_code text;
update members set card_code=new_check_code() where card_code is null;
alter table members alter column card_code set default new_check_code();
create unique index if not exists members_card_code_uq on members(card_code);

-- Anyone who scans a member ID card sees only: name, member number, position, club and whether the card is valid.
create or replace function verify_member(p_code text) returns jsonb language plpgsql security definer set search_path=public as $$
declare m members; c text := upper(regexp_replace(coalesce(p_code,''),'[^0-9A-Za-z]','','g')); ry_to date; begin
  if length(c)<>12 then return jsonb_build_object('error','not found'); end if;
  select * into m from members where card_code=c and deleted_at is null;
  if m.id is null then return jsonb_build_object('error','not found'); end if;
  ry_to := make_date(case when extract(month from current_date)>=7 then extract(year from current_date)::int+1 else extract(year from current_date)::int end,6,30);
  return jsonb_build_object('name',m.full_name,'member_no',m.member_no,'position',m.position,'type',m.membership_type,'status',m.status,
    'photo_url',m.photo_url,'blood_group',m.blood_group,'joined_on',m.joined_on,'valid_till',ry_to,'club',(select club_name from settings where id=1));
end $$;
grant execute on function verify_member(text) to anon, authenticated;

-- members may set their own photo (the file is uploaded to the member-photos bucket first)
create or replace function set_my_photo(p_url text) returns void language plpgsql security definer set search_path=public as $$
declare m members := my_member(); begin
  if m.id is null then raise exception 'Your login is not linked to a member record'; end if;
  if p_url is not null and p_url !~ '/member-photos/' then raise exception 'Upload the photo first'; end if;
  update members set photo_url=p_url where id=m.id; end $$;
revoke execute on function set_my_photo(text) from public, anon;
grant execute on function set_my_photo(text) to authenticated;

do $$ begin
  if exists(select 1 from pg_namespace where nspname='storage') then
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
      values('member-photos','member-photos',true,2097152,array['image/png','image/jpeg','image/webp'])
      on conflict (id) do nothing;
    if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='member photos read') then
      create policy "member photos read" on storage.objects for select to anon, authenticated using (bucket_id='member-photos');
      -- staff with the Members permission upload any photo; a member uploads only into a folder named with their own member id
      create policy "member photos upload" on storage.objects for insert to authenticated
        with check (bucket_id='member-photos' and (public.perm('members') or (storage.foldername(name))[1]=(select (public.my_member()).id::text)));
      create policy "member photos replace" on storage.objects for update to authenticated
        using (bucket_id='member-photos' and (public.perm('members') or (storage.foldername(name))[1]=(select (public.my_member()).id::text)));
    end if;
  end if; end $$;

-- ---------- donor cards ----------
alter table pledges add column if not exists card_issued_on date;
update pledges set card_issued_on=coalesce(card_issued_on,pledged_on) where card_issued and card_issued_on is null;

-- ---------- camp materials ----------
create sequence if not exists camp_materials_item_no_seq;
create table if not exists camp_materials(
  id uuid primary key default gen_random_uuid(),
  item_no int not null unique,
  camp_id uuid not null references camps on delete cascade,
  item text not null, category text not null default 'Other'
    check (category in ('Banners and printing','Medical supplies','Refreshments','Certificates and gifts','Stationery','Furniture and setup','Other')),
  qty_needed numeric(10,2) not null default 1, qty_ready numeric(10,2) not null default 0, unit text default 'nos',
  source text not null default 'To buy' check (source in ('To buy','Sponsored','Borrowed','Blood bank','Club stock')),
  responsible text, status text not null default 'needed' check (status in ('needed','arranged','at venue','returned')),
  cost numeric(12,2), notes text, created_at timestamptz not null default now());
alter table camp_materials enable row level security;
create policy "materials manage" on camp_materials for all using (perm('planning')) with check (perm('planning'));
create policy "materials read camp day" on camp_materials for select using (perm('campday'));

create or replace function validate_material() returns trigger language plpgsql set search_path=public as $$
begin
  if length(trim(coalesce(new.item,'')))<2 then raise exception 'Enter the item name'; end if;
  if new.qty_needed is null or new.qty_needed<=0 then raise exception 'Quantity needed must be more than 0'; end if;
  if new.qty_ready<0 then raise exception 'Quantity ready cannot be negative'; end if;
  if new.cost is not null and new.cost<0 then raise exception 'Cost cannot be negative'; end if;
  if tg_op='INSERT' then new.item_no := coalesce(new.item_no,nextval('camp_materials_item_no_seq')); end if;
  new.item := trim(new.item); return new; end $$;
create or replace trigger validate_camp_materials before insert or update on camp_materials for each row execute function validate_material();
create or replace trigger audit_camp_materials after insert or update or delete on camp_materials for each row execute function audit_row();
grant select, insert, update, delete on camp_materials to authenticated;
grant usage, select on sequence camp_materials_item_no_seq to authenticated;
revoke execute on function validate_material() from public, anon, authenticated;
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='camp_materials') then
    alter publication supabase_realtime add table camp_materials; end if; end $$;
