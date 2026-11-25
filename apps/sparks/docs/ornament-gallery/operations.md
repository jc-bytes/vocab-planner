# Christmas 2026 gallery

The public route is `/view-models/`. Class pages use `/view-models/6a/`, `6b/`, or `6c/`. Share the matching `this-is-mine/` route and its class code in Classroom. Teacher ballots use `/view-models/teachers/`. All model cards have rotatable previews and still images. Offline or unavailable database records default to display only. The collection includes 16 entries from 6A, 31 from 6B and 21 from 6C. Some models have lettering designed by their creators. Check publication permissions for the artwork itself before launch.

The Sparks migration creates the isolated event, class codes, and print decisions. Use the following queries in the private Supabase SQL editor. Keep class codes in their own Classroom section. Issue a separate teacher code to each invited teacher. A teacher code identifies one editable score per ornament. Audience votes use an anonymous browser token. Clearing browser storage allows a new audience ballot.

```sql
select section, code from ornament_gallery.class_code where event_id='christmas-2026' order by section;
insert into ornament_gallery.teacher_code(event_id) values ('christmas-2026') returning code;
select id, model_id, private_name, title, credit from ornament_gallery.claim where status='pending' order by id;
-- Pass the chosen claim ID and true to approve or false to decline.
-- select ornament_gallery.review_claim(<claim_id>,true);
```

Review an ownership claim against Classroom before approving it. Approving publishes only the submitted title and optional public credit. Model IDs and anonymous credit are used before approval. To withdraw an eligibility decision, set approved=false for that model and exact asset. Review any replacement version again.

Close the event and export results with these queries. Audience and teacher results stay separate. Only ratings for currently approved file versions appear.

```sql
update ornament_gallery.event set voting_open=false, claims_open=false where id='christmas-2026';
select v.model_id, v.teacher, count(*) as ratings, round(avg(v.score),2) as average
from ornament_gallery.vote v join ornament_gallery.model m
on (m.event_id,m.id,m.asset)=(v.event_id,v.model_id,v.asset)
where v.event_id='christmas-2026' and m.approved
group by v.model_id,v.teacher order by v.teacher,average desc;
```

When removal is authorized, deleting the `christmas-2026` row from `ornament_gallery.event` cascades to its votes, codes, claims and models. Remove the gallery routes and media from the static site in the same retirement release. The Classroom originals stay in Drive.

## Local preview

From the Sparks app directory, run `node scripts/preview-ornaments.mjs`. Open http://127.0.0.1:4386/view-models/ on the same computer. This uses the event migration in a local PostgreSQL-compatible database and does not contact hosted Supabase for event requests. Local class and teacher codes are saved in `~/.local/share/sparks/ornament-gallery-local/local-access.md`. Production codes are generated separately by the hosted database. For a clean verification run, set ORNAMENT_DB_DIR to a fresh directory and ORNAMENT_PORT to an unused port.
