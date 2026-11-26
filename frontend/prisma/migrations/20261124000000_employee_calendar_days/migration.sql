-- Superseded by 20261124010000_employee_calendar_days, which creates "employee_calendar_days"
-- with the "code" / "calendarId" columns the app uses. This used to create a duplicate table
-- with a "shortCode" column; 20261124020000_employee_calendar_days_reconcile repairs any database
-- that ran the old version. Intentionally a no-op.
SELECT 1;
