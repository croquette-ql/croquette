import type { DocumentNode, OperationDefinitionNode, SelectionSetNode } from 'graphql';
import { OperationIdGenerator } from '../types';
import { DefaultOperationIdGenerator } from './operation-id';

interface NodeReference {
  __ref: true;
  type: string;
  id: string;
}

type NormalizedDataAtom = NodeReference | string | number | boolean | null | undefined;
type NormalizedDataValue = NormalizedDataAtom | ReadonlyArray<NormalizedDataAtom>;
type NormalizedDataRecord = { __typename: string } & Record<string, NormalizedDataValue>;
type NormalizedData = Record<string, NormalizedDataRecord>;

export type NodeCacheCreateOptions = {
  initialData?: {
    operationResults: Record<string, string>;
    normalizedData: NormalizedData;
  };
  idGenerator?: OperationIdGenerator;
};

export type CacheResult = {
  data: any;
  missingDataLocations: string[];
};

function isNodeReference(x: any): x is NodeReference {
  return typeof x === 'object' && x.__ref === true;
}

function findQueryOperationASTNode(ast: DocumentNode) {
  const hit = ast.definitions.find(node => {
    return node.kind === 'OperationDefinition' && node.operation === 'query';
  });
  if (!hit) {
    throw new Error('no query');
  }
  return hit as OperationDefinitionNode;
}

export class NodeCache {
  private _normalizedData: NormalizedData;
  private _operationResults: Record<string, string>;
  private _operationIdGenerator: OperationIdGenerator;

  constructor(options: NodeCacheCreateOptions = {}) {
    this._normalizedData = options.initialData?.normalizedData ?? {};
    this._operationResults = options.initialData?.operationResults ?? {};
    this._operationIdGenerator = options.idGenerator ?? new DefaultOperationIdGenerator();
  }

  readQuery({ query, variables }: { query: DocumentNode; variables: any }) {
    const operationId = this._operationIdGenerator.getOperationId({ query, variables });
    const operationResultKey = this._operationResults[operationId];
    if (!operationResultKey) {
      return {
        data: null,
        missingDataLocations: [], // FIXME
      };
    }
    const queryAstNode = findQueryOperationASTNode(query);
    const missingDataLocations: string[] = [];

    const record = this._normalizedData[operationResultKey];
    const selectionSet = queryAstNode.selectionSet;
    const getSelectionData = (selectionSet: SelectionSetNode, targetRecord: any) => {
      const ret: any = {};
      selectionSet.selections.forEach(selection => {
        if (selection.kind === 'Field') {
          const value = targetRecord[selection.name.value];
          if (selection.selectionSet) {
            if (isNodeReference(value)) {
              const nextRecord = this._normalizedData[`${value.type}:${value.id}`];
              ret[selection.name.value] = getSelectionData(selection.selectionSet, nextRecord);
            } else if (Array.isArray(value)) {
              ret[selection.name.value] = value.map(v => {
                if (isNodeReference(v)) {
                  const nextRecord = this._normalizedData[`${v.type}:${v.id}`];
                  return getSelectionData(selection.selectionSet!, nextRecord);
                } else {
                  throw new Error('Illegal selection');
                }
              });
            } else {
              throw new Error('Illegal selection');
            }
          } else if (typeof value !== 'undefined') {
            ret[selection.name.value] = value;
          } else {
            missingDataLocations.push(selection.name.value);
          }
        }
      });
      return ret;
    };
    const data = getSelectionData(selectionSet, record);

    if (missingDataLocations.length > 0) {
      return {
        data: null,
        missingDataLocations,
      };
    } else {
      return {
        data,
        missingDataLocations: [],
      };
    }
  }
}
