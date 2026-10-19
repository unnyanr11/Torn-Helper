-- Torn Command Center - Phase 31 automated loan reminder notifications (spec section 12)

-- Add a notification rule type for loan due reminders
alter table public.alert_rules drop constraint if exists alert_rules_condition_type_check;
alter table public.alert_rules add constraint alert_rules_condition_type_check check (condition_type in ('target_available','energy_threshold','cooldown_expired','loan_due'));

-- Add a due_soon_days threshold column for loan reminders
alter table public.alert_rules add column if not exists due_soon_days int not null default 3 check (due_soon_days >= 0);
