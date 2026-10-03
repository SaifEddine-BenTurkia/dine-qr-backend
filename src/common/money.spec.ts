import {
  formatDinars,
  fromMillimes,
  percentOf,
  sumMillimes,
  toMillimes,
} from './money';

describe('money (millimes)', () => {
  it.each([
    [12, 12000],
    [12.5, 12500],
    [4.5, 4500],
    [0.1, 100],
    [2.8, 2800],
    ['12,500', 12500],
    ['12.5', 12500],
    ['12D500', 12500],
    ['12d5', 12500],
    ['12 DT', 12000],
    ['12,5 TND', 12500],
    ['1 200,750 DT', 1200750],
    ['0', 0],
  ])('parses %p as %p millimes', (input, expected) => {
    expect(toMillimes(input)).toBe(expected);
  });

  it.each([
    [-1],
    ['abc'],
    ['12,5000'],
    [1.0005],
    [Number.NaN],
    [''],
    ['12.'],
    ['-3'],
  ])('refuses %p', (input) => {
    expect(toMillimes(input)).toBeNull();
  });

  it('never drifts like floating-point dinars', () => {
    // 0.1 + 0.2 !== 0.3 in floats; in millimes it is exact.
    expect(sumMillimes([toMillimes(0.1)!, toMillimes(0.2)!])).toBe(300);
    const prices = Array.from({ length: 1000 }, () => toMillimes('2,800')!);
    expect(sumMillimes(prices)).toBe(2_800_000);
  });

  it('converts back to dinars, takes percentages and formats', () => {
    expect(fromMillimes(4500)).toBe(4.5);
    expect(percentOf(4500, 20)).toBe(900);
    expect(percentOf(1999, 10)).toBe(200);
    expect(formatDinars(4500)).toBe('4,500 DT');
    expect(formatDinars(22000)).toBe('22 DT');
    expect(formatDinars(1200750)).toBe('1 200,750 DT');
  });
});
