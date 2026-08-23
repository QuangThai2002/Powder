alter function public.powder_official_launch_preflight_v2000(text,text,text) rename to powder_official_launch_preflight_base_v2000;

create or replace function public.powder_official_launch_preflight_v2000(
  p_channel text default 'production',
  p_build text default 'powder-20.0.0-official-launch-gate',
  p_manifest_hash text default ''
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  base jsonb; rec jsonb; rec_ok boolean:=false; final_ready boolean:=false; checks jsonb;
begin
  base:=public.powder_official_launch_preflight_base_v2000(p_channel,p_build,p_manifest_hash);
  begin
    rec:=public.powder_recovery_posture_v2040(p_channel,p_build);
    rec_ok:=coalesce((rec->>'ready')::boolean,false);
  exception when others then
    rec:=jsonb_build_object('version','20.4.0','ready',false,'error',sqlerrm);
    rec_ok:=false;
  end;
  final_ready:=coalesce((base->>'ready')::boolean,false) and rec_ok;
  checks:=coalesce(base->'checks','{}'::jsonb)||jsonb_build_object('recovery',rec_ok);
  return (base-'ready'-'checks')||jsonb_build_object('ready',final_ready,'checks',checks,'recovery',rec);
end $$;
revoke all on function public.powder_official_launch_preflight_v2000(text,text,text) from public,anon,authenticated;
grant execute on function public.powder_official_launch_preflight_v2000(text,text,text) to service_role;
revoke all on function public.powder_official_launch_preflight_base_v2000(text,text,text) from public,anon,authenticated;
grant execute on function public.powder_official_launch_preflight_base_v2000(text,text,text) to service_role;
