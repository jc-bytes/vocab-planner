-- A retired unit can have one final save that exists only in its receipt.
alter table private.student_progress_event_receipts
    add column preserve_final_work boolean not null default false;

CREATE OR REPLACE FUNCTION private.prune_student_progress_operational_history(p_receipt_retention interval DEFAULT '90 days'::interval, p_cron_retention interval DEFAULT '30 days'::interval)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    deleted_receipts bigint;
begin
    if p_receipt_retention < interval '7 days' then
        raise exception 'Receipt retention must be at least 7 days.';
    end if;
    if p_cron_retention < interval '7 days' then
        raise exception 'Cron retention must be at least 7 days.';
    end if;

    delete from private.student_progress_event_receipts
    where created_at < now() - p_receipt_retention
      and not preserve_final_work;
    get diagnostics deleted_receipts = row_count;

    delete from cron.job_run_details
    where end_time is not null and end_time < now() - p_cron_retention;

    return deleted_receipts;
end;
$function$;
