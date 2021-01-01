import { resolveValueNode } from './resolve-value-node';

describe(resolveValueNode, () => {
  it('should resolve variables in the value node', () => {
    expect(resolveValueNode({ kind: 'Variable', name: { kind: 'Name', value: 'hoge' } }, { hoge: 100 })).toBe(100);
    expect(
      resolveValueNode(
        { kind: 'ListValue', values: [{ kind: 'Variable', name: { kind: 'Name', value: 'hoge' } }] },
        { hoge: 100 },
      ),
    ).toStrictEqual([100]);
    expect(
      resolveValueNode(
        {
          kind: 'ObjectValue',
          fields: [
            {
              kind: 'ObjectField',
              name: { kind: 'Name', value: 'a' },
              value: { kind: 'Variable', name: { kind: 'Name', value: 'hoge' } },
            },
          ],
        },
        { hoge: 100 },
      ),
    ).toStrictEqual({ a: 100 });
  });
  it('should throw an error when variables are not defined', () => {
    expect(() =>
      resolveValueNode({ kind: 'Variable', name: { kind: 'Name', value: 'hoge' } }, { fuga: 'fuga' }),
    ).toThrowError();
  });
});
