-- v22: website and social handles printed on posts. Run once, after v21.
alter table settings add column if not exists website text;
alter table settings add column if not exists instagram text;
alter table settings add column if not exists facebook text;
create or replace function public_brand() returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('brand_name',brand_name,'tagline',tagline,'logo_url',logo_url,'brand_color',brand_color,'club_name',club_name,
    'address',address,'contact_phone',contact_phone,'contact_email',contact_email,'signatory_name',signatory_name,'signatory_title',signatory_title,
    'signatory2_name',signatory2_name,'signatory2_title',signatory2_title,'reg_no',reg_no,'default_theme',default_theme,
    'intl_logo_url',intl_logo_url,'intl_logo_label',intl_logo_label,'website',website,'instagram',instagram,'facebook',facebook)
  from settings where id=1 $$;
grant execute on function public_brand() to anon, authenticated;
