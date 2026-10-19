-- Personal planning records. These do not certify Torn transfers or counterparty consent.
create table public.workspace_presets (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 kind text not null check(kind in ('comparison','leaderboard','target_layout','roi')),
 name text not null check(length(btrim(name)) between 1 and 80),
 config jsonb not null check(jsonb_typeof(config)='object' and octet_length(config::text)<=200000),
 created_at timestamptz not null default now(), unique(user_id,kind,name)
);
alter table public.workspace_presets enable row level security;
create policy own_presets on public.workspace_presets for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.workspace_presets from anon,authenticated;
grant select,insert,update,delete on public.workspace_presets to authenticated;
grant all on public.workspace_presets to service_role;

create table public.mortgage_agreements (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 borrower_name text not null check(length(btrim(borrower_name)) between 1 and 80),
 borrower_torn_id bigint check(borrower_torn_id between 1 and 9007199254740991),
 principal bigint not null check(principal between 1 and 1000000000000),
 annual_bps integer not null check(annual_bps between 0 and 10000),
 months integer not null check(months between 1 and 600),
 first_due date not null check(first_due between date '2000-01-01' and date '2100-12-31'),
 notes text not null default '' check(length(notes)<=4000),
 status text not null default 'application' check(status in ('application','active','declined','cancelled','settled')),
 created_at timestamptz not null default now(), activated_at timestamptz,
 unique(id,user_id)
);
create index mortgage_agreements_owner_created on public.mortgage_agreements(user_id,created_at desc);
create table public.mortgage_installments (
 id uuid primary key default gen_random_uuid(), agreement_id uuid not null, user_id uuid not null,
 installment_number integer not null check(installment_number between 1 and 600), due_date date not null,
 principal bigint not null check(principal>0), interest bigint not null check(interest>=0),
 amount bigint generated always as (principal+interest) stored,
 paid bigint not null default 0 check(paid>=0 and paid<=principal+interest),
 balance bigint not null check(balance>=0), unique(agreement_id,installment_number),
 foreign key(agreement_id,user_id) references public.mortgage_agreements(id,user_id) on delete cascade
);
create index mortgage_installments_owner_due on public.mortgage_installments(user_id,due_date);
create table public.mortgage_payments (
 id uuid primary key default gen_random_uuid(), agreement_id uuid not null, user_id uuid not null,
 amount bigint not null check(amount>0), paid_on date not null check(paid_on between date '2000-01-01' and date '2200-12-31'),
 reference text not null check(length(btrim(reference)) between 1 and 120),
 recorded_at timestamptz not null default now(), voided_at timestamptz, void_reason text,
 unique(user_id,reference), foreign key(agreement_id,user_id) references public.mortgage_agreements(id,user_id) on delete cascade
);
create index mortgage_payments_agreement on public.mortgage_payments(agreement_id);
create table public.mortgage_payment_allocations (
 payment_id uuid not null references public.mortgage_payments(id) on delete cascade,
 installment_id uuid not null references public.mortgage_installments(id) on delete cascade,
 amount bigint not null check(amount>0), primary key(payment_id,installment_id)
);
create index mortgage_allocations_installment on public.mortgage_payment_allocations(installment_id);
create table public.mortgage_events (
 id uuid primary key default gen_random_uuid(), agreement_id uuid not null, user_id uuid not null,
 action text not null, details jsonb not null default '{}', created_at timestamptz not null default now(),
 foreign key(agreement_id,user_id) references public.mortgage_agreements(id,user_id) on delete cascade
);
create index mortgage_events_agreement on public.mortgage_events(agreement_id,created_at);
do $$ declare t text; begin
 foreach t in array array['mortgage_agreements','mortgage_installments','mortgage_payments','mortgage_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy owner_read on public.%I for select to authenticated using(user_id=(select auth.uid()))',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop; end $$;
alter table public.mortgage_payment_allocations enable row level security;
create policy owner_read on public.mortgage_payment_allocations for select to authenticated using(exists(select 1 from public.mortgage_payments p where p.id=payment_id and p.user_id=(select auth.uid())));
revoke all on public.mortgage_payment_allocations from anon,authenticated;
grant select on public.mortgage_payment_allocations to authenticated;
grant all on public.mortgage_payment_allocations to service_role;

create function private.apply_mortgage(borrower text, torn_id bigint, requested_principal bigint, rate_bps integer, term_months integer, first_payment date, memo text) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); agreement uuid;
begin
 if uid is null then raise exception 'Sign in required'; end if;
 insert into public.mortgage_agreements(user_id,borrower_name,borrower_torn_id,principal,annual_bps,months,first_due,notes)
 values(uid,btrim(borrower),torn_id,requested_principal,rate_bps,term_months,first_payment,coalesce(memo,'')) returning id into agreement;
 insert into public.mortgage_events(agreement_id,user_id,action) values(agreement,uid,'application_created');
 return agreement;
end $$;
create function private.decide_mortgage(agreement uuid, decision text) returns void language plpgsql security definer set search_path='' as $$
declare m public.mortgage_agreements; remaining bigint; payment bigint; interest_due bigint; principal_due bigint; due date; i integer;
begin
 select * into m from public.mortgage_agreements where id=agreement and user_id=auth.uid() for update;
 if not found then raise exception 'Agreement unavailable'; end if;
 if m.status<>'application' or decision is null or decision not in ('active','declined','cancelled') then raise exception 'Only applications can be activated, declined or cancelled'; end if;
 if decision='active' then
 remaining:=m.principal;
 payment:=case when m.annual_bps=0 then greatest(1,round(m.principal::numeric/m.months)) else round(m.principal::numeric*(m.annual_bps::numeric/120000)/(1-power(1+m.annual_bps::numeric/120000,-m.months))) end;
 for i in 1..m.months loop
 exit when remaining=0;
 interest_due:=round(remaining::numeric*m.annual_bps/120000);
 principal_due:=case when i=m.months then remaining else least(remaining,greatest(1,payment-interest_due)) end;
 remaining:=remaining-principal_due;
 -- Anchor to original calendar day, clamping to each month's last day.
 due:=(date_trunc('month',m.first_due)+(i-1)*interval '1 month')::date;
 due:=due+least(extract(day from m.first_due)::integer,extract(day from (due+interval '1 month'-interval '1 day'))::integer)-1;
 insert into public.mortgage_installments(agreement_id,user_id,installment_number,due_date,principal,interest,balance) values(m.id,m.user_id,i,due,principal_due,interest_due,remaining);
 end loop;
 end if;
 update public.mortgage_agreements set status=decision,activated_at=case when decision='active' then now() else null end where id=m.id;
 insert into public.mortgage_events(agreement_id,user_id,action,details) values(m.id,m.user_id,'application_'||decision,jsonb_build_object('principal',m.principal,'annual_bps',m.annual_bps,'months',m.months,'first_due',m.first_due));
end $$;
create function private.record_mortgage_payment(agreement uuid, payment_amount bigint, payment_date date, payment_reference text) returns uuid language plpgsql security definer set search_path='' as $$
declare m public.mortgage_agreements; payment uuid; outstanding bigint; remaining bigint:=payment_amount; part bigint; inst record;
begin
 select * into m from public.mortgage_agreements where id=agreement and user_id=auth.uid() for update;
 if not found then raise exception 'Agreement unavailable'; end if;
 if m.status<>'active' or payment_amount is null or payment_amount<=0 then raise exception 'An active agreement and positive payment are required'; end if;
 select sum(amount-paid) into outstanding from public.mortgage_installments where agreement_id=m.id;
 if payment_amount>outstanding then raise exception 'Payment exceeds outstanding schedule'; end if;
 -- Reference uniqueness provides retry protection; it is not Torn transaction verification.
 insert into public.mortgage_payments(agreement_id,user_id,amount,paid_on,reference) values(m.id,m.user_id,payment_amount,payment_date,btrim(payment_reference)) returning id into payment;
 for inst in select * from public.mortgage_installments where agreement_id=m.id and paid<amount order by installment_number for update loop
 exit when remaining=0; part:=least(remaining,inst.amount-inst.paid);
 update public.mortgage_installments set paid=paid+part where id=inst.id;
 insert into public.mortgage_payment_allocations(payment_id,installment_id,amount) values(payment,inst.id,part);
 remaining:=remaining-part;
 end loop;
 if payment_amount=outstanding then update public.mortgage_agreements set status='settled' where id=m.id; end if;
 insert into public.mortgage_events(agreement_id,user_id,action,details) values(m.id,m.user_id,'payment_recorded',jsonb_build_object('payment_id',payment,'amount',payment_amount,'reference',btrim(payment_reference)));
 return payment;
end $$;
create function private.void_mortgage_payment(payment uuid, reason text) returns void language plpgsql security definer set search_path='' as $$
declare p public.mortgage_payments; m public.mortgage_agreements; alloc record;
begin
 -- Serialize every mutation on the agreement before locking payment/installments.
 select * into p from public.mortgage_payments where id=payment and user_id=auth.uid();
 if not found then raise exception 'Payment unavailable'; end if;
 select * into m from public.mortgage_agreements where id=p.agreement_id and user_id=auth.uid() for update;
 select * into p from public.mortgage_payments where id=payment for update;
 if p.voided_at is not null or reason is null or length(btrim(reason)) not between 1 and 1000 then raise exception 'A current payment and correction reason are required'; end if;
 for alloc in select * from public.mortgage_payment_allocations where payment_id=p.id loop
 update public.mortgage_installments set paid=paid-alloc.amount where id=alloc.installment_id;
 end loop;
 update public.mortgage_payments set voided_at=now(),void_reason=btrim(reason) where id=p.id;
 update public.mortgage_agreements set status='active' where id=m.id;
 insert into public.mortgage_events(agreement_id,user_id,action,details) values(m.id,m.user_id,'payment_voided',jsonb_build_object('payment_id',p.id,'amount',p.amount,'reason',btrim(reason)));
end $$;
-- Expose invoker wrappers only. All privileged implementations stay outside the API schema.
create function public.apply_mortgage(borrower text,torn_id bigint,requested_principal bigint,rate_bps integer,term_months integer,first_payment date,memo text default '') returns uuid language sql security invoker set search_path='' as $$ select private.apply_mortgage(borrower,torn_id,requested_principal,rate_bps,term_months,first_payment,memo) $$;
create function public.decide_mortgage(agreement uuid,decision text) returns void language sql security invoker set search_path='' as $$ select private.decide_mortgage(agreement,decision) $$;
create function public.record_mortgage_payment(agreement uuid,payment_amount bigint,payment_date date,payment_reference text) returns uuid language sql security invoker set search_path='' as $$ select private.record_mortgage_payment(agreement,payment_amount,payment_date,payment_reference) $$;
create function public.void_mortgage_payment(payment uuid,reason text) returns void language sql security invoker set search_path='' as $$ select private.void_mortgage_payment(payment,reason) $$;
do $$ declare signature text; begin
 foreach signature in array array['apply_mortgage(text,bigint,bigint,integer,integer,date,text)','decide_mortgage(uuid,text)','record_mortgage_payment(uuid,bigint,date,text)','void_mortgage_payment(uuid,text)'] loop
 execute 'revoke all on function private.'||signature||' from public,anon,authenticated';
 execute 'revoke all on function public.'||signature||' from public,anon,authenticated';
 execute 'grant execute on function private.'||signature||' to authenticated';
 execute 'grant execute on function public.'||signature||' to authenticated';
 end loop; end $$;
