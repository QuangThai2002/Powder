-- Powder 18.8.0 hotfix: Phá Băng only triggers if target was Frozen before the action.
do $patch$
declare d text;
begin
  d:=pg_get_functiondef('public.powder_pvp_action_v1880(uuid,uuid,text,text,text,text,integer)'::regprocedure);
  if position('old_target_frozen' in d)=0 then
    d:=replace(d,'used jsonb; qi int;','used jsonb; old_target_frozen boolean:=false; qi int;');
    d:=replace(d,'if found then old_target_hp:=target.hp;old_target_shield:=greatest(0,coalesce((target.statuses->>''shield'')::int,0));active_target:=true;old_tdef:=target.def; end if;','if found then old_target_hp:=target.hp;old_target_shield:=greatest(0,coalesce((target.statuses->>''shield'')::int,0));old_target_frozen:=coalesce((target.statuses->>''Freeze'')::int,0)>0;active_target:=true;old_tdef:=target.def; end if;');
    d:=replace(d,'if coalesce((target.statuses->>''Freeze'')::int,0)>0 then','if old_target_frozen then');
    execute d;
  end if;
end $patch$;
