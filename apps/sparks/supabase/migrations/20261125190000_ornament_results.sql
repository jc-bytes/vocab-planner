create function ornament_gallery.results() returns jsonb
language sql stable security definer set search_path='' as $$
  with scores as (
    select split_part(m.id,'-',1) as section, m.id, m.asset, m.title, m.credit,
           v.teacher, avg(v.score) as average, count(*) as votes
    from ornament_gallery.model m
    join ornament_gallery.vote v on (v.event_id,v.model_id,v.asset)=(m.event_id,m.id,m.asset)
    where m.event_id='christmas-2026' and m.approved
    group by m.event_id,m.id,v.teacher
  ), placed as (
    select *, row_number() over (
      partition by section,teacher order by average desc,votes desc,id
    ) as place from scores
  )
  select coalesce(jsonb_agg(to_jsonb(p) order by teacher,section,place),'[]'::jsonb)
  from placed p where place<=3;
$$;

create function public.ornament_results() returns jsonb
language sql stable security invoker set search_path='' as $$ select ornament_gallery.results() $$;
revoke all on function ornament_gallery.results(), public.ornament_results() from public;
grant execute on function ornament_gallery.results(), public.ornament_results() to anon, authenticated;
