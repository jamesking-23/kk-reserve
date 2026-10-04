-- Run before and after any migration; numbers must match exactly.
select user_id, 'budgets' t, count(*) n, sum(starting_balance) total from public.budgets group by user_id
union all select user_id, 'planned_categories', count(*), sum(amount) from public.planned_categories group by user_id
union all select user_id, 'expenses', count(*), sum(amount) from public.expenses group by user_id
order by 1, 2;
-- Rollback note (migration 001): all changes are additive. To undo, drop the added columns,
-- tables reserves/reserve_contributions, the 4 indexes and the 2 avatar policies. Restore data from schema backup_pre_glass if ever needed.
