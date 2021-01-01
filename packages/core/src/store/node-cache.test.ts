import { parse } from 'graphql';
import { NodeCache } from './node-cache';

describe(NodeCache, () => {
  describe('selection pattern', () => {
    describe(NodeCache.prototype.readQuery, () => {
      it('should return data when query has flat scalar selection', () => {
        const cache = new NodeCache({
          initialData: {
            operationResults: {
              'MyQuery/{}': 'Query:0',
            },
            normalizedData: {
              'Query:0': {
                __typename: 'Query',
                stringValue: 'hello',
                intValue: 1,
                floatValue: 1.0,
                boolValue: false,
                nullableValue: null,
              },
            },
          },
        });
        const query = `
          query MyQuery {
            stringValue
            intValue
            floatValue
            boolValue
            nullableValue
          }
        `;
        expect(cache.readQuery({ query: parse(query), variables: {} })).toStrictEqual({
          data: {
            stringValue: 'hello',
            intValue: 1,
            floatValue: 1.0,
            boolValue: false,
            nullableValue: null,
          },
          missingDataLocations: [],
        });
      });

      it('should return data when query has nested object selection', () => {
        const cache = new NodeCache({
          initialData: {
            operationResults: {
              'MyQuery/{}': 'Query:0',
            },
            normalizedData: {
              'Query:0': {
                __typename: 'Query',
                greeting: { __ref: true, type: 'Greeting', id: '0' },
              },
              'Greeting:0': {
                __typename: 'Greeting',
                hello: 'world',
              },
            },
          },
        });
        const query = `
          query MyQuery {
            greeting {
              hello
            }
          }
        `;
        expect(cache.readQuery({ query: parse(query), variables: {} })).toStrictEqual({
          data: {
            greeting: {
              hello: 'world',
            },
          },
          missingDataLocations: [],
        });
      });

      it('should return data when query has array selection', () => {
        const cache = new NodeCache({
          initialData: {
            operationResults: {
              'MyQuery/{}': 'Query:0',
            },
            normalizedData: {
              'Query:0': {
                __typename: 'Query',
                nodes: [
                  { __ref: true, type: 'Node', id: '0' },
                  { __ref: true, type: 'Node', id: '1' },
                ],
              },
              'Node:0': {
                __typename: 'Node',
                name: 'hoge',
              },
              'Node:1': {
                __typename: 'Node',
                name: 'fuga',
              },
            },
          },
        });
        const query = `
          query MyQuery {
            nodes {
              name
            }
          }
        `;
        expect(cache.readQuery({ query: parse(query), variables: {} })).toStrictEqual({
          data: {
            nodes: [{ name: 'hoge' }, { name: 'fuga' }],
          },
          missingDataLocations: [],
        });
      });

      it('should return data when query has fargment spread', () => {
        const cache = new NodeCache({
          initialData: {
            operationResults: {
              'MyQuery/{}': 'Query:0',
            },
            normalizedData: {
              'Query:0': {
                __typename: 'Query',
                hello: 'world',
              },
            },
          },
        });
        const query = `
          fragment MyFragment on Query {
            hello
          }
          query MyQuery {
            ...MyFragment
          }
        `;
        expect(cache.readQuery({ query: parse(query), variables: {} })).toStrictEqual({
          data: {
            hello: 'world',
          },
          missingDataLocations: [],
        });
      });
    });

    describe(NodeCache.prototype.writeQuery, () => {
      it('should write data with query', () => {
        const cache = new NodeCache();
        const query = `
          query MyQuery {
            stringValue
            intValue
            floatValue
            boolValue
            nullableValue
          }
        `;
        cache.writeQuery(
          { query: parse(query), variables: {} },
          {
            __typename: 'Query',
            stringValue: 'hello',
            intValue: 1,
            floatValue: 1.0,
            boolValue: false,
            nullableValue: null,
          },
        );
        expect(cache.serialize()).toMatchSnapshot();
      });

      it('should write data when query has nested object selection', () => {
        const cache = new NodeCache();
        const query = `
          query MyQuery {
            greeting {
              hello
            }
          }
        `;
        cache.writeQuery(
          { query: parse(query), variables: {} },
          {
            __typename: 'Query',
            greeting: {
              __typename: 'Greeting',
              hello: 'world',
            },
          },
        );
        expect(cache.serialize()).toMatchSnapshot();
      });

      it('should write data when query has nested object selection with id field', () => {
        const cache = new NodeCache();
        const query = `
          query MyQuery {
            greeting {
              id
              hello
            }
          }
        `;
        cache.writeQuery(
          { query: parse(query), variables: {} },
          {
            __typename: 'Query',
            greeting: {
              __typename: 'Greeting',
              id: '0',
              hello: 'world',
            },
          },
        );
        expect(cache.serialize()).toMatchSnapshot();
      });

      it('should write data when query has array selection', () => {
        const cache = new NodeCache();
        const query = `
          query MyQuery {
            nodes {
              name
            }
          }
        `;
        cache.writeQuery(
          { query: parse(query), variables: {} },
          {
            __typename: 'Query',
            nodes: [
              { __typename: 'Node', name: 'hoge' },
              { __typename: 'Node', name: 'fuga' },
            ],
          },
        );
        expect(cache.serialize()).toMatchSnapshot();
      });

      it('should write data when query has fragment spread', () => {
        const cache = new NodeCache();
        const query = `
          fragment MyFragment on Query {
            hello
          }
          query MyQuery {
            ...MyFragment
          }
        `;
        cache.writeQuery(
          { query: parse(query), variables: {} },
          {
            __typename: 'Query',
            hello: 'world',
          },
        );
        expect(cache.serialize()).toMatchSnapshot();
      });
    });
  });

  describe('built-in directives', () => {
    describe('@skip/@include', () => {
      it('should filter data to store using @skip/@include condition', () => {
        const cache = new NodeCache();
        const query = `
          query MyQuery {
            f0 
            f1 @skip(if: true)
            f2 @skip(if: false)
            f3 @include(if: true)
            f4 @include(if: false)
            f5 @skip(if: true) @include(if: true)
            f6 @skip(if: false) @include(if: true)
            f7 @skip(if: true) @include(if: false)
            f8 @skip(if: false) @include(if: false)
          }
        `;
        cache.writeQuery(
          { query: parse(query), variables: {} },
          {
            __typename: 'Query',
            id: '0',
            f0: 100,
            f1: 100,
            f2: 100,
            f3: 100,
            f4: 100,
            f5: 100,
            f6: 100,
            f7: 100,
            f8: 100,
          },
        );
        expect(Object.keys(cache.serialize().normalizedData['Query:0'])).toStrictEqual([
          '__typename',
          'f0',
          'f2',
          'f3',
          'f6',
        ]);
      });
    });
  });
});
