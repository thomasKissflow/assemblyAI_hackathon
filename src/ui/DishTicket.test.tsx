// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DishTicket } from './DishTicket';
import { kindPhoto, menuRecipes } from '../kitchen/recipes';
import { MIN, advance, createPlan, reportDelay } from '../kitchen/planner';

const T0 = new Date(2026, 8, 28, 19, 15).getTime();
const plan = createPlan(menuRecipes('indian'), T0 + 45 * MIN, T0);
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

  it('lists only the step that matters when compact', () => {
    const fired = advance(plan, T0 + 7 * MIN).plan;
    render(<DishTicket dish={naan(fired)} now={T0 + 7 * MIN} compact />);
    expect(screen.getByTestId('ticket-garlic_naan')).toHaveClass('is-compact');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('listitem')).toHaveTextContent(/mix & knead dough/i);
  });

  it('keeps quiet +5 min and Done buttons with full accessible names', () => {
    const fired = advance(plan, T0 + 7 * MIN).plan;
    render(<DishTicket dish={naan(fired)} now={T0 + 7 * MIN} onDelay={() => {}} onDone={() => {}} />);
    expect(screen.getByRole('button', { name: 'Garlic naan needs 5 more minutes' })).toBeVisible();
    expect(screen.getByRole('button', { name: /garlic naan: mix & knead dough is done/i })).toBeVisible();
  });

  it('lists a window of a long recipe and summarises the rest', () => {
    const long = {
      id: 'my_biryani', name: 'Biryani', short: 'biryani', photo: kindPhoto('rice'), kind: 'rice' as const, custom: true,
      steps: Array.from({ length: 10 }, (_, i) => ({ id: `s${i + 1}`, label: `Step ${i + 1}`, call: 'Biryani.', minutes: 5 })),
    };
    const p = createPlan([long], T0 + 60 * MIN, T0);
    const { rerender } = render(<DishTicket dish={p.dishes[0]} now={T0} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByText('6 more steps')).toBeInTheDocument();
    const later = advance(p, T0 + 36 * MIN).plan;
    rerender(<DishTicket dish={later.dishes[0]} now={T0 + 36 * MIN} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByText('4 steps done')).toBeInTheDocument();
    expect(screen.getByText('3 more steps')).toBeInTheDocument();
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Step 6');
  });

  it('shows a plain plate when a dish image is missing', () => {
    const custom = { ...naan(plan), id: 'my_dal', photo: kindPhoto('curry') };
    const { container } = render(<DishTicket dish={custom} now={T0} />);
    const img = container.querySelector('img.dish-photo')!;
    expect(img).toHaveClass('is-art');
    fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.dish-photo.is-missing')).not.toBeNull();
  });
});
