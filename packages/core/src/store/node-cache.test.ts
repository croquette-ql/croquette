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
  });
});
