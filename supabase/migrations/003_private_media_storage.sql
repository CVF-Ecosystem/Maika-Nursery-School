-- Private media storage: images of children must not be exposed through public bucket URLs.

update storage.buckets
set public = false
where id = 'maika-media';

drop policy if exists "storage maika media select" on storage.objects;
drop policy if exists "storage maika media teacher write" on storage.objects;
drop policy if exists "storage maika media teacher select own facility" on storage.objects;
drop policy if exists "storage maika media parent select published linked" on storage.objects;
drop policy if exists "storage maika media teacher insert scoped" on storage.objects;

create policy "storage maika media teacher select own facility"
on storage.objects for select
using (
  bucket_id = 'maika-media'
  and public.current_user_role() = 'teacher'
  and (storage.foldername(name))[1] = public.current_facility_id()::text
);

create policy "storage maika media parent select published linked"
on storage.objects for select
using (
  bucket_id = 'maika-media'
  and public.current_user_role() = 'parent'
  and exists (
    select 1
    from public.media_assets ma
    where ma.storage_path = storage.objects.name
      and ma.status = 'published'
      and (
        exists (
          select 1
          from public.parent_student_links psl
          join public.students s on s.id = psl.student_id
          where psl.parent_profile_id = auth.uid()
            and ma.student_id = s.id
            and (ma.facility_id is null or ma.facility_id = s.facility_id)
        )
        or (
          ma.student_id is null
          and exists (
            select 1
            from public.parent_student_links psl
            join public.students s on s.id = psl.student_id
            where psl.parent_profile_id = auth.uid()
              and ma.facility_id = s.facility_id
          )
        )
      )
  )
);

create policy "storage maika media teacher insert scoped"
on storage.objects for insert
with check (
  bucket_id = 'maika-media'
  and public.current_user_role() = 'teacher'
  and (storage.foldername(name))[1] = public.current_facility_id()::text
);
