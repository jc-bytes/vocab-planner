alter table public.profiles
drop constraint if exists profiles_student_aid_email_domain;

alter table public.profiles
add constraint profiles_student_aid_email_domain
check (
    role = 'teacher'
    or lower(email::text) like '%@aid.edu.pa'
);
