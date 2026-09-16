ALTER TABLE verification_cases DROP CONSTRAINT IF EXISTS verification_cases_status_check;
ALTER TABLE verification_cases ADD CONSTRAINT verification_cases_status_check CHECK (status IN ('NOT_STARTED','PENDING','IN_PROGRESS','MORE_INFO_REQUIRED','VERIFIED','REJECTED','EXPIRED'));
