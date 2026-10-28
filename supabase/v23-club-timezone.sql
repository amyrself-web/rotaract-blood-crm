-- v23: the database works in Indian time, so "today" means the club's today.
-- Before this, checks like "date cannot be in the future" used UTC, and between midnight and 5:30 AM
-- a receipt or donation dated today was rejected. Takes effect for new connections. Run once, after v22.
do $$ begin execute format('alter database %I set timezone to %L', current_database(), 'Asia/Kolkata'); end $$;
