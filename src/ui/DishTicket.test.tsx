// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DishTicket } from './DishTicket';
import { MENUS } from '../kitchen/recipes';
import { MIN, advance, createPlan, reportDelay } from '../kitchen/planner';

const T0 = new Date(2026, 8, 28, 19, 15).getTime();
const plan = createPlan(MENUS.indian.dishes, T0 + 45 * MIN, T0);
const naan = (p: typeof plan) => p.dishes.find(d => d.id === 'garlic_naan')!;

describe('DishTicket', () => {
  it('shows waiting, then fire when its step starts', () => {
    const { rerender } = render(<DishTicket dish={naan(plan)} now={T0} />);
    expect(screen.getByTestId('ticket-garlic_naan')).toHaveAttribute('data-state', 'waiting');
    const fired = advance(plan, T0 + 7 * MIN).plan;
    rerender(<DishTicket dish={naan(fired)} now={T0 + 7 * MIN} />);
    expect(screen.getByTestId('ticket-garlic_naan')).toHaveAttribute('data-state', 'fire');
    expect(screen.getAllByText(/mix & knead dough/i).length).toBeGreaterThan(0);
  });

  it('shows ready at service', () => {
    const done = advance(plan, T0 + 45 * MIN).plan;
    render(<DishTicket dish={naan(done)} now={T0 + 45 * MIN} />);
    expect(screen.getByTestId('ticket-garlic_naan')).toHaveAttribute('data-state', 'ready');
  });

  it('flags a re-plan with the minutes the dish moved', () => {
    const started = advance(plan, T0 + 10 * MIN).plan;
    const curry = (p: typeof plan) => p.dishes.find(d => d.id === 'chicken_curry')!;
    const { rerender } = render(<DishTicket dish={curry(started)} now={T0 + 10 * MIN} />);
    const delayed = reportDelay(started, 'chicken_curry', 10, T0 + 10 * MIN);
    rerender(<DishTicket dish={curry(delayed)} now={T0 + 10 * MIN} />);
    expect(screen.getByTestId('ticket-delta-chicken_curry')).toHaveTextContent('+10 min');
  });
});
