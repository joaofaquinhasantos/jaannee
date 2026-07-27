-- JaanNee: protect approved dish photos from submitter mutation.
-- EXISTING LIVE DATABASE ONLY.
-- MANUAL EXECUTION REQUIRED. This file has not been executed by Codex.

BEGIN;

-- Photos are served only by the application proxy. The service role used by
-- that proxy bypasses storage RLS, so the bucket does not need a public read
-- policy.
DROP POLICY IF EXISTS "dish photos public read" ON storage.objects;

-- Objects are uploaded once with upsert=false. Authenticated users never need
-- UPDATE permission on an existing storage object.
DROP POLICY IF EXISTS "dish photos owner update" ON storage.objects;

-- Submitters may clean up unused pending uploads, but an object referenced by
-- an approved dish is immutable. Admins replace an approved photo by uploading
-- a new object and updating the dish row; the previous unreferenced object can
-- then be cleaned up by its owner.
DROP POLICY IF EXISTS "dish photos owner delete" ON storage.objects;
CREATE POLICY "dish photos owner delete unapproved only"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'dish-photos'
    AND owner = auth.uid()
    AND NOT EXISTS (
      SELECT 1
      FROM public.dishes d
      WHERE d.status = 'approved'
        AND d.photo_url = '/photos/' || storage.objects.name
    )
  );

COMMIT;
