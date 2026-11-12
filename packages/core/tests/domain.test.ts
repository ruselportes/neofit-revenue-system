import { describe, expect, it } from 'vitest';
import { LogbookEntry, Money, PlanParser, RateBook, ValidationError } from '../src';

describe('Money', () => {
  it('sums without floating point drift', () => {
    expect(Money.sum([Money.pesos(0.1), Money.pesos(0.2)]).pesos).toBe(0.3);
  });
  it('rejects negative amounts', () => {
    expect(() => Money.pesos(-1)).toThrow(ValidationError);
  });
});

describe('PlanParser and RateBook', () => {
  const rates = RateBook.neofitDefault();

  it('prices a student semi-monthly plan with treadmill', () => {
    const plan = PlanParser.parse('Student Plan - Semi-Monthly (With Treadmill)');
    expect(rates.priceOf(plan)?.pesos).toBe(400);
  });
  it('defaults unknown text to Regular Monthly No Treadmill', () => {
    expect(rates.priceOf(PlanParser.parse(''))?.pesos).toBe(700);
  });
  it('lists the distinct official amounts', () => {
    expect(rates.validAmounts()).toEqual([60, 70, 80, 90, 300, 350, 400, 450, 600, 700, 800, 900]);
  });
});

describe('LogbookEntry', () => {
  it('requires a name', () => {
    expect(() => new LogbookEntry('  ', 20)).toThrow(ValidationError);
  });
  it('is immutable: edits return a new entry', () => {
    const a = new LogbookEntry('Ian', 450);
    const b = a.withAmount(70);
    expect(a.amount?.pesos).toBe(450);
    expect(b.amount?.pesos).toBe(70);
  });
  it('totals only entries that have an amount', () => {
    const total = LogbookEntry.total([new LogbookEntry('A', 20), new LogbookEntry('B', null)]);
    expect(total.pesos).toBe(20);
  });
});
