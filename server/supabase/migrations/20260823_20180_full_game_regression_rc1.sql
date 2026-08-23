-- Powder 20.18.0 · Full Game Regression RC1 evidence contract
begin;
create table if not exists public.full_game_regression_config_v20180(
 id smallint primary key default 1 check(id=1),enabled boolean not null default false,max_age_hours int not null default 168 check(max_age_hours between 1 and 336),updated_at timestamptz not null default now(),updated_by text not null default ''
);
insert into public.full_game_regression_config_v20180(id) values(1) on conflict(id) do nothing;
create table if not exists public.full_game_regression_runs_v20180(
 id bigserial primary key,channel text not null default 'production',build_id text not null,manifest_hash text not null,artifact_sha256 text not null,automated_checks jsonb not null default '{}'::jsonb,manual_checks jsonb not null default '{}'::jsonb,summary jsonb not null default '{}'::jsonb,critical_count int not null default 0,high_count int not null default 0,automated_pass boolean not null default false,manual_pass boolean not null default false,pass boolean not null default false,evidence_sha256 text not null,runner_revision text not null default '',created_at timestamptz not null default now(),created_by text not null default ''
);
create index if not exists full_game_regression_runs_v20180_build_idx on public.full_game_regression_runs_v20180(channel,build_id,created_at desc);

create or replace function public.powder_full_game_regression_record_v20180(p_channel text,p_build text,p_manifest_hash text,p_artifact_sha256 text,p_automated jsonb,p_manual jsonb,p_summary jsonb,p_evidence_sha256 text,p_runner_revision text,p_actor text default 'ci')
returns jsonb language plpgsql security definer set search_path=public as $$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;auto_required text[]:=array['powDex99','skills396','rank7','roleCoverage99','equipment13x4','artifacts49','gearArtifactAssets','learningBank','learningPromptRegression','dailyBossContract','adventure12Islands','gachaRatesGuard','playerNavigation','coreSubsystemEntrypoints','combatFreeze22','runtimeSelfTest'];manual_required text[]:=array['homeAndNavigation','learningFlow','powDexInventory','gachaFlow','equipmentArtifactFlow','pveFlow','pvpFlow','bossFlow','eventAndMailReward','rankPromotion','cloudSaveConflict','adminSmoke','fpsSmoke'];k text;auto_ok boolean:=true;manual_ok boolean:=true;crit int:=greatest(0,coalesce((p_summary->>'critical')::int,0));hi int:=greatest(0,coalesce((p_summary->>'high')::int,0));final_ok boolean;rid bigint;
begin
 if p_build<>'powder-20.18.0-full-game-regression-rc1' then raise exception 'RC20180_BUILD_MISMATCH';end if;
 if p_manifest_hash!~'^[0-9a-fA-F]{16,64}$' or p_artifact_sha256!~'^[0-9a-fA-F]{64}$' or p_evidence_sha256!~'^[0-9a-fA-F]{64}$' then raise exception 'RC20180_EVIDENCE_HASH_INVALID';end if;
 foreach k in array auto_required loop if coalesce((p_automated->>k)::boolean,false) is not true then auto_ok:=false;end if;end loop;
 foreach k in array manual_required loop if coalesce((p_manual->>k)::boolean,false) is not true then manual_ok:=false;end if;end loop;
 final_ok:=auto_ok and manual_ok and crit=0 and hi=0;
 insert into public.full_game_regression_runs_v20180(channel,build_id,manifest_hash,artifact_sha256,automated_checks,manual_checks,summary,critical_count,high_count,automated_pass,manual_pass,pass,evidence_sha256,runner_revision,created_by)
 values(c,p_build,p_manifest_hash,p_artifact_sha256,coalesce(p_automated,'{}'::jsonb),coalesce(p_manual,'{}'::jsonb),coalesce(p_summary,'{}'::jsonb),crit,hi,auto_ok,manual_ok,final_ok,lower(p_evidence_sha256),left(coalesce(p_runner_revision,''),160),left(coalesce(p_actor,'ci'),160)) returning id into rid;
 return jsonb_build_object('ok',true,'id',rid,'automatedPass',auto_ok,'manualPass',manual_ok,'critical',crit,'high',hi,'pass',final_ok,'recordedAt',now());
end $$;

create or replace function public.powder_full_game_regression_posture_v20180(p_channel text default 'production',p_build text default 'powder-20.18.0-full-game-regression-rc1',p_manifest_hash text default '')
returns jsonb language plpgsql security definer set search_path=public as $$
declare c text:=case when p_channel='staging' then 'staging' else 'production' end;cfg public.full_game_regression_config_v20180;r public.full_game_regression_runs_v20180;fresh boolean:=false;ready boolean:=false;
begin
 select * into cfg from public.full_game_regression_config_v20180 where id=1;
 select * into r from public.full_game_regression_runs_v20180 where channel=c and build_id=p_build and (p_manifest_hash='' or manifest_hash=p_manifest_hash) order by created_at desc limit 1;
 fresh:=r.id is not null and r.created_at>=now()-make_interval(hours=>coalesce(cfg.max_age_hours,168));
 ready:=coalesce(cfg.enabled,false) and fresh and coalesce(r.pass,false) and coalesce(r.automated_pass,false) and coalesce(r.manual_pass,false) and coalesce(r.critical_count,1)=0 and coalesce(r.high_count,1)=0;
 return jsonb_build_object('version','20.18.0','ready',ready,'armed',coalesce(cfg.enabled,false),'fresh',fresh,'maxAgeHours',coalesce(cfg.max_age_hours,168),'run',case when r.id is null then null else to_jsonb(r) end,'checks',jsonb_build_object('automated',coalesce(r.automated_pass,false),'manual',coalesce(r.manual_pass,false),'criticalZero',coalesce(r.critical_count,1)=0,'highZero',coalesce(r.high_count,1)=0,'manifestBound',r.id is not null and (p_manifest_hash='' or r.manifest_hash=p_manifest_hash)),'checkedAt',now());
end $$;

revoke all on table public.full_game_regression_config_v20180 from public,anon,authenticated;
revoke all on table public.full_game_regression_runs_v20180 from public,anon,authenticated;
revoke all on function public.powder_full_game_regression_record_v20180(text,text,text,text,jsonb,jsonb,jsonb,text,text,text) from public,anon,authenticated;
revoke all on function public.powder_full_game_regression_posture_v20180(text,text,text) from public,anon,authenticated;
grant select,insert,update on public.full_game_regression_config_v20180 to service_role;
grant select,insert on public.full_game_regression_runs_v20180 to service_role;
grant usage,select on sequence public.full_game_regression_runs_v20180_id_seq to service_role;
grant execute on function public.powder_full_game_regression_record_v20180(text,text,text,text,jsonb,jsonb,jsonb,text,text,text) to service_role;
grant execute on function public.powder_full_game_regression_posture_v20180(text,text,text) to service_role;
commit;
