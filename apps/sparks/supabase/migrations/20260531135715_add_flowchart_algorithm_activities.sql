alter table public.classroom_activities
    drop constraint if exists classroom_activities_activity_type_check;

alter table public.classroom_activities
    drop constraint if exists classroom_activities_type_check;

alter table public.classroom_activities
    add constraint classroom_activities_type_check
    check (activity_type in (
        'map-diagram',
        'structured-response',
        'card-sort',
        'spreadsheet-table',
        'image-hotspot',
        'external-artifact',
        'flowchart-algorithm'
    ));

alter table public.classroom_activity_assignments
    drop constraint if exists classroom_activity_assignments_activity_type_check;

alter table public.classroom_activity_assignments
    drop constraint if exists classroom_activity_assignments_type_check;

alter table public.classroom_activity_assignments
    add constraint classroom_activity_assignments_type_check
    check (activity_type in (
        'map-diagram',
        'structured-response',
        'card-sort',
        'spreadsheet-table',
        'image-hotspot',
        'external-artifact',
        'flowchart-algorithm'
    ));
