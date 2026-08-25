-- Powder 21.7.1 · PvP Domain Supremacy server parity
-- Applies the verified 21.6.9/21.7.0 correct-gap multipliers to numeric Domain effects on the PvP server.

create or replace function public.powder_pvp_domain_supremacy_scale_v2171(p_match uuid,p_user uuid)
returns numeric
language plpgsql
security definer
stable
set search_path=public
as $$
declare s jsonb; v numeric;
begin
  select expansion_state into s from public.pvp_match_players where match_id=p_match and user_id=p_user;
  if not found then return 1; end if;
  begin v:=coalesce((s->>'supremacyScale')::numeric,1); exception when others then v:=1; end;
  return greatest(0,least(1.5,v));
end;
$$;
revoke all on function public.powder_pvp_domain_supremacy_scale_v2171(uuid,uuid) from public,anon,authenticated;

create or replace function public.powder_pvp_apply_domain_supremacy_v2171(p_clash uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  c public.pvp_domain_clashes_v2170%rowtype;
  winner uuid; uid uuid; other uuid; dom text; es jsonb; scale numeric; own_scale numeric:=1; enemy_scale numeric:=1; tier int:=0; delta int; desired int;
begin
  select * into c from public.pvp_domain_clashes_v2170 where id=p_clash for update;
  if not found or c.status<>'resolved' then return; end if;
  begin winner:=nullif(c.result->>'winnerUserId','')::uuid; exception when others then winner:=null; end;
  begin own_scale:=coalesce((c.result#>>'{supremacy,ownEffectScale}')::numeric,1); exception when others then own_scale:=1; end;
  begin enemy_scale:=coalesce((c.result#>>'{supremacy,enemyEffectScale}')::numeric,1); exception when others then enemy_scale:=1; end;
  begin tier:=coalesce((c.result#>>'{supremacy,tier}')::int,0); exception when others then tier:=0; end;
  own_scale:=greatest(0,least(1.5,own_scale)); enemy_scale:=greatest(0,least(1.5,enemy_scale));

  foreach uid in array array[c.player_a,c.player_b] loop
    other:=case when uid=c.player_a then c.player_b else c.player_a end;
    scale:=case when winner is null then 1 when uid=winner then own_scale else enemy_scale end;
    select expansion_id,coalesce(expansion_state,'{}'::jsonb) into dom,es from public.pvp_match_players where match_id=c.match_id and user_id=uid for update;
    if not found then continue; end if;

    -- Deterministic opening effects are corrected from the original x1.00 opening to the verified scale.
    if coalesce((es->>'active')::boolean,false) and scale>0 then
      if dom='draw_swords' then
        update public.pvp_match_pows p set
          max_hp=greatest(1,round((p.max_hp/1.30)*(1+.30*scale))),
          hp=case
            when greatest(1,round((p.max_hp/1.30)*(1+.30*scale)))>p.max_hp then least(greatest(1,round((p.max_hp/1.30)*(1+.30*scale))),p.hp+(greatest(1,round((p.max_hp/1.30)*(1+.30*scale)))-p.max_hp))
            else least(greatest(1,round((p.max_hp/1.30)*(1+.30*scale))),p.hp)
          end
        from public.pvp_pow_catalog pc
        where p.match_id=c.match_id and p.user_id=uid and p.pow_id=pc.pow_id and pc.role not in('Hiệp sĩ','Đấu sĩ','Đỡ đòn') and not p.eliminated;
      elsif dom='diamond_guard' then
        delta:=round(.12*(scale-1)*1000000); -- ratio marker; actual per-Pow delta is computed below.
        update public.pvp_match_pows p set statuses=(
          case
            when greatest(0,coalesce((p.statuses->>'shield')::int,0)+round(p.max_hp*.12*(scale-1)))>0
              then jsonb_set(coalesce(p.statuses,'{}'::jsonb),'{shield}',to_jsonb(greatest(0,coalesce((p.statuses->>'shield')::int,0)+round(p.max_hp*.12*(scale-1)))),true)
            else coalesce(p.statuses,'{}'::jsonb)-'shield'
          end)
        where p.match_id=c.match_id and p.user_id=uid and not p.eliminated;
      elsif dom='rebirth_wood' then
        es:=jsonb_set(es,'{sinhQi}',to_jsonb(greatest(0,least(100,round(25*scale)))),true);
      end if;
    end if;

    es:=jsonb_set(es,'{supremacyScale}',to_jsonb(scale),true);
    es:=jsonb_set(es,'{supremacyTier}',to_jsonb(tier),true);
    es:=jsonb_set(es,'{supremacyVerified}','true'::jsonb,true);
    es:=jsonb_set(es,'{supremacyClashId}',to_jsonb(c.id::text),true);
    update public.pvp_match_players set expansion_state=es where match_id=c.match_id and user_id=uid;

    if scale<=0 then
      -- Expire the losing Domain through the canonical cleanup path, then remove Domain-owned markers that v1880 could not provenance-tag.
      perform public.powder_pvp_domain_expire_v1880(c.match_id,uid,'domain_supremacy_cancel_v2171');
      if dom='diamond_guard' then
        update public.pvp_match_pows p set statuses=case when greatest(0,coalesce((p.statuses->>'shield')::int,0)-round(p.max_hp*.12))>0 then jsonb_set(coalesce(p.statuses,'{}'::jsonb),'{shield}',to_jsonb(greatest(0,coalesce((p.statuses->>'shield')::int,0)-round(p.max_hp*.12))),true) else coalesce(p.statuses,'{}'::jsonb)-'shield' end where p.match_id=c.match_id and p.user_id=uid and not p.eliminated;
      elsif dom='myriad_poison' then
        update public.pvp_match_pows set statuses=coalesce(statuses,'{}'::jsonb)-'DomainPoisonStacks'-'AntiHealPct'-'AntiHeal'-'Poison' where match_id=c.match_id and user_id=other and coalesce((statuses->>'DomainPoisonStacks')::int,0)>0;
      end if;
      select coalesce(expansion_state,'{}'::jsonb) into es from public.pvp_match_players where match_id=c.match_id and user_id=uid for update;
      es:=jsonb_set(es,'{active}','false'::jsonb,true);
      es:=jsonb_set(es,'{remainingActions}',to_jsonb(0),true);
      es:=jsonb_set(es,'{supremacyScale}',to_jsonb(0),true);
      es:=jsonb_set(es,'{supremacyTier}',to_jsonb(tier),true);
      es:=jsonb_set(es,'{supremacyVerified}','true'::jsonb,true);
      es:=jsonb_set(es,'{supremacyClashId}',to_jsonb(c.id::text),true);
      update public.pvp_match_players set expansion_state=es where match_id=c.match_id and user_id=uid;
    end if;
  end loop;
end;
$$;
revoke all on function public.powder_pvp_apply_domain_supremacy_v2171(uuid) from public,anon,authenticated;

create or replace function public.powder_pvp_domain_supremacy_resolve_trigger_v2171()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.status='resolved' and old.status is distinct from 'resolved' then
    perform public.powder_pvp_apply_domain_supremacy_v2171(new.id);
  end if;
  return new;
end;
$$;
revoke all on function public.powder_pvp_domain_supremacy_resolve_trigger_v2171() from public,anon,authenticated;
drop trigger if exists trg_domain_supremacy_resolve_v2171 on public.pvp_domain_clashes_v2170;
create trigger trg_domain_supremacy_resolve_v2171
after update of status on public.pvp_domain_clashes_v2170
for each row execute function public.powder_pvp_domain_supremacy_resolve_trigger_v2171();

-- Domain direct max-HP damage is a numeric Domain effect; scale it server-side.
create or replace function public.powder_pvp_domain_direct_damage_v1880(p_match uuid,p_source_user uuid,p_target_user uuid,p_target_pow text,p_ratio numeric,p_label text,p_status text default null,p_status_turns integer default 0)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare m public.pvp_matches; t public.pvp_match_pows; resist numeric:=0; requested int:=0; amount int:=0; shield int:=0; absorbed int:=0; hp_damage int:=0; ns jsonb; sup_scale numeric:=1; apply_status boolean:=true;
begin
 select * into m from public.pvp_matches where id=p_match for update;
 if not found or m.status<>'active' then return jsonb_build_object('ok',false,'damage',0); end if;
 sup_scale:=public.powder_pvp_domain_supremacy_scale_v2171(p_match,p_source_user);
 if sup_scale<=0 then return jsonb_build_object('ok',true,'damage',0,'absorbed',0,'requested',0,'supremacyScale',0,'domainCancelled',true); end if;
 select * into t from public.pvp_match_pows where match_id=p_match and user_id=p_target_user and pow_id=p_target_pow for update;
 if not found or t.eliminated or t.hp<=0 then return jsonb_build_object('ok',false,'damage',0); end if;
 resist:=public.powder_pvp_simple_resist_v1880(p_match,p_target_user,m.turn_no);
 requested:=greatest(1,round(t.max_hp*greatest(0,p_ratio)*sup_scale));
 amount:=greatest(1,round(requested*(1-resist)));
 ns:=coalesce(t.statuses,'{}'::jsonb);
 shield:=greatest(0,coalesce((ns->>'shield')::int,0)); absorbed:=least(shield,amount); shield:=shield-absorbed; hp_damage:=amount-absorbed;
 if shield>0 then ns:=jsonb_set(ns,'{shield}',to_jsonb(shield),true); else ns:=ns-'shield'; end if;
 if sup_scale<1 and p_status in('Freeze','Stun','Shock','Burn','Poison') then apply_status:=random()<sup_scale; end if;
 if p_status is not null and p_status_turns>0 and t.hp-hp_damage>0 and apply_status then
   if p_status='AntiHeal' then ns:=jsonb_set(jsonb_set(ns,'{AntiHeal}',to_jsonb(p_status_turns),true),'{AntiHealPct}',to_jsonb(least(.95,.50*sup_scale)),true);
   elsif p_status='Shock' then ns:=jsonb_set(jsonb_set(ns,'{Shock}',to_jsonb(p_status_turns),true),'{Slow}',to_jsonb(greatest(1,round(2*least(1,sup_scale)))),true);
   else ns:=jsonb_set(ns,array[p_status],to_jsonb(p_status_turns),true); end if;
 end if;
 update public.pvp_match_pows set hp=greatest(0,hp-hp_damage),statuses=ns,eliminated=(hp-hp_damage<=0) where match_id=p_match and user_id=p_target_user and pow_id=p_target_pow;
 perform public.powder_pvp_domain_log_v1880(p_match,p_source_user,null,p_target_pow,'domain_damage',jsonb_build_object('label',p_label,'requested',requested,'damage',hp_damage,'absorbed',absorbed,'resist',resist,'status',p_status,'statusApplied',apply_status,'supremacyScale',sup_scale));
 return jsonb_build_object('ok',true,'damage',hp_damage,'absorbed',absorbed,'requested',requested,'resist',resist,'supremacyScale',sup_scale,'statusApplied',apply_status);
end;
$$;

-- Patch the current canonical PvP action function in-place using exact guarded fragments.
-- This preserves the large battle function while adding the verified per-side multiplier at its numeric Domain-effect sites.
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='powder_pvp_action_v1880' and p.prokind='f' limit 1;
  if d is null then raise exception 'POWDER_V2171_ACTION_FUNCTION_MISSING'; end if;
  if position('sup_scale numeric:=1; enemy_sup_scale numeric:=1;' in d)=0 then
    if position('mult numeric:=1; domain_bonus numeric:=0; question_scale numeric:=1;' in d)=0 then raise exception 'POWDER_V2171_PATCH_DECL_DRIFT'; end if;
    d:=replace(d,'mult numeric:=1; domain_bonus numeric:=0; question_scale numeric:=1;','mult numeric:=1; domain_bonus numeric:=0; question_scale numeric:=1; sup_scale numeric:=1; enemy_sup_scale numeric:=1;');

    if position('enemyactive:=coalesce((op.expansion_state->>''active'')::boolean,false); enemyid:=op.expansion_state->>''id'';' in d)=0 then raise exception 'POWDER_V2171_PATCH_STATE_DRIFT'; end if;
    d:=replace(d,'enemyactive:=coalesce((op.expansion_state->>''active'')::boolean,false); enemyid:=op.expansion_state->>''id'';','enemyactive:=coalesce((op.expansion_state->>''active'')::boolean,false); enemyid:=op.expansion_state->>''id''; sup_scale:=public.powder_pvp_domain_supremacy_scale_v2171(p_match,p_user); enemy_sup_scale:=public.powder_pvp_domain_supremacy_scale_v2171(p_match,other); if sup_scale<=0 then myactive:=false; end if; if enemy_sup_scale<=0 then enemyactive:=false; end if;');

    d:=replace(d,'domain_bonus:=domain_bonus*(1-enemy_simple_resist);','domain_bonus:=domain_bonus*(1-enemy_simple_resist)*sup_scale;');
    d:=replace(d,'if coalesce((actor.statuses->>''DomainCold'')::int,0)>0 then mult:=mult*greatest(.50,1-.07*least(3,(actor.statuses->>''DomainCold'')::int)); end if;','if coalesce((actor.statuses->>''DomainCold'')::int,0)>0 then mult:=mult*greatest(.50,1-.07*least(3,(actor.statuses->>''DomainCold'')::int)*enemy_sup_scale); end if;');
    d:=replace(d,'if coalesce((actor.statuses->>''DomainCorrosion'')::int,0)>0 then mult:=mult*.90; end if;','if coalesce((actor.statuses->>''DomainCorrosion'')::int,0)>0 then mult:=mult*greatest(.50,1-.10*enemy_sup_scale); end if;');
    d:=replace(d,'if active_target and coalesce((target.statuses->>''DomainCorrosion'')::int,0)>0 then update public.pvp_match_pows set def=greatest(1,round(def*.85))','if active_target and coalesce((target.statuses->>''DomainCorrosion'')::int,0)>0 then update public.pvp_match_pows set def=greatest(1,round(def*(1-.15*sup_scale)))');
    d:=replace(d,'if myid=''rebirth_wood'' and coalesce((mp.expansion_state->>''sinhQi'')::int,0)>=75 then mult:=mult*1.20; end if;','if myid=''rebirth_wood'' and coalesce((mp.expansion_state->>''sinhQi'')::int,0)>=75 then mult:=mult*(1+.20*sup_scale); end if;');
    d:=replace(d,'if threshold50 then update public.pvp_match_pows set hp=least(max_hp,hp+greatest(1,round(max_hp*.06)))','if threshold50 then update public.pvp_match_pows set hp=least(max_hp,hp+greatest(1,round(max_hp*.06*sup_scale)))');
    d:=replace(d,'update public.pvp_match_pows set hp=least(max_hp,hp+greatest(1,round(max_hp*.20))),statuses=jsonb_set((statuses-''Burn''-''Poison''-''Slow''-''Stun''-''Freeze''),''{shield}'',to_jsonb(greatest(coalesce((statuses->>''shield'')::int,0),round(max_hp*.15)::int)),true)','update public.pvp_match_pows set hp=least(max_hp,hp+greatest(1,round(max_hp*.20*sup_scale))),statuses=jsonb_set((statuses-''Burn''-''Poison''-''Slow''-''Stun''-''Freeze''),''{shield}'',to_jsonb(greatest(coalesce((statuses->>''shield'')::int,0),round(max_hp*.15*sup_scale)::int)),true)');
    d:=replace(d,'if role_name not in(''Hiệp sĩ'',''Đấu sĩ'',''Đỡ đòn'') and damage>0 then update public.pvp_match_pows set hp=least(max_hp,hp+greatest(1,round(damage*.30)))','if role_name not in(''Hiệp sĩ'',''Đấu sĩ'',''Đỡ đòn'') and damage>0 then update public.pvp_match_pows set hp=least(max_hp,hp+greatest(1,round(damage*.30*sup_scale)))');
    d:=replace(d,''''{AntiHealPct}'',to_jsonb(.30),true)'',''''{AntiHealPct}'',to_jsonb(least(.95,.30*sup_scale)),true)'');
    d:=replace(d,'if marks>=3 then update public.pvp_match_pows set statuses=jsonb_set(statuses,''{Freeze}'',to_jsonb(1),true)','if marks>=3 and (sup_scale>=1 or random()<sup_scale) then update public.pvp_match_pows set statuses=jsonb_set(statuses,''{Freeze}'',to_jsonb(1),true)');

    -- Bất Động Kim Cương Giới had catalog reduction but v1880 never applied it. Apply it as an opposing numeric Domain effect.
    d:=replace(d,'mult:=mult*question_scale;','if enemyactive and enemyid=''diamond_guard'' then mult:=mult*greatest(.10,1-.30*enemy_sup_scale); end if; mult:=mult*question_scale;');
    execute d;
  end if;
end $$;
