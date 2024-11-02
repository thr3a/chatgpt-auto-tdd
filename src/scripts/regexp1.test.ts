import { assert, describe, expect, it } from 'vitest';
import { myfunc } from './regexp1';

describe('正規表現', () => {
  it('正しいこと', () => {
    expect(myfunc('合資会社日本○○○')).toEqual([]);
    expect(myfunc('株式会社○○組')).toEqual(['株式会社○○組']);
    expect(myfunc('合同会社○○製作所')).toEqual(['合同会社○○製作所']);
    expect(myfunc('○○商事株式会社')).toEqual([]);
  });
});
