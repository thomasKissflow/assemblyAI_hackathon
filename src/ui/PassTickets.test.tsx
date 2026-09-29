// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { PassTickets, LEAVE_MS } from './PassTickets';
import { BUILTIN_RECIPES, menuRecipes } from '../kitchen/recipes';
import { MIN, addDish, createPlan, removeDish } from '../kitchen/planner';

const T0 = new Date(2026, 8, 28, 19, 15).getTime();
const plan = createPlan(menuRecipes('indian'), T0 + 45 * MIN, T0);
const salmon = BUILTIN_RECIPES.find(r => r.id === 'salmon')!;
const slot = (id: string) => screen.getByTestId(`ticket-${id}`).parentElement!;

afterEach(() => vi.useRealTimers());

describe('PassTickets', () => {
  it('hangs the first tickets without an entrance, and animates a dish added mid-cook', () => {
    const { rerender } = render(<PassTickets dishes={plan.dishes} now={T0} />);
    expect(slot('chicken_curry')).toHaveClass('is-stay');
    const more = addDish(plan, salmon, T0);
    rerender(<PassTickets dishes={more.dishes} now={T0} />);
    expect(slot('salmon')).toHaveClass('is-enter');
    expect(slot('chicken_curry')).toHaveClass('is-stay');
  });

  it('keeps a dropped dish in place while it fades out, then removes it', () => {
    vi.useFakeTimers();
    const { rerender, container } = render(<PassTickets dishes={plan.dishes} now={T0} />);
    const fewer = removeDish(plan, 'jeera_rice', T0);
    rerender(<PassTickets dishes={fewer.dishes} now={T0} />);
    const order = () => [...container.querySelectorAll<HTMLElement>('[data-slot]')].map(e => e.dataset.slot);
    expect(order()).toEqual(['chicken_curry', 'jeera_rice', 'garlic_naan']);
    expect(slot('jeera_rice')).toHaveClass('is-leave');
    expect(slot('jeera_rice')).toHaveAttribute('aria-hidden', 'true');
    act(() => {
      vi.advanceTimersByTime(LEAVE_MS + 10);
    });
    expect(order()).toEqual(['chicken_curry', 'garlic_naan']);
  });

  it('switches to compact tickets from five dishes', () => {
    const six = createPlan(BUILTIN_RECIPES.slice(0, 6), T0 + 60 * MIN, T0);
    const { container, rerender } = render(<PassTickets dishes={six.dishes.slice(0, 4)} now={T0} />);
    expect(container.querySelector('.pass-tickets')).not.toHaveClass('is-compact');
    rerender(<PassTickets dishes={six.dishes} now={T0} />);
    expect(container.querySelector('.pass-tickets')).toHaveClass('is-compact');
    expect(screen.getAllByRole('article').every(a => a.classList.contains('is-compact'))).toBe(true);
  });
});
