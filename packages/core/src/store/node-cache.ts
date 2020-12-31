import type { DocumentNode, OperationDefinitionNode, SelectionSetNode, FragmentDefinitionNode } from 'graphql';
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

function getFragmentDefinitionMap(ast: DocumentNode) {
  const map = new Map<string, FragmentDefinitionNode>();
  ast.definitions.forEach(def => {
    if (def.kind === 'FragmentDefinition') {
      map.set(def.name.value, def);
    }
  });
  return map;
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

  serialize() {
    return {
      normalizedData: this._normalizedData,
      operationResults: this._operationResults,
    };
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
    const fragmentMap = getFragmentDefinitionMap(query);
    const missingDataLocations: string[] = [];

    const record = this._normalizedData[operationResultKey];
    const selectionSet = queryAstNode.selectionSet;
    const getSelectionData = (selectionSet: SelectionSetNode, targetRecord: any) => {
      let ret: any = {};
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
        } else if (selection.kind === 'FragmentSpread') {
          const fragmentDef = fragmentMap.get(selection.name.value);
          if (!fragmentDef) {
            throw new Error(`cannot find fragment definition for ${selection.name.value}`);
          }
          ret = { ...ret, ...getSelectionData(fragmentDef.selectionSet, targetRecord) };
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

  writeQuery({ query, variables }: { query: DocumentNode; variables: any }, data: any) {
    const operationId = this._operationIdGenerator.getOperationId({ query, variables });
    const queryAstNode = findQueryOperationASTNode(query);
    const fragmentMap = getFragmentDefinitionMap(query);
    const writeSelectionData = (selectionSet: SelectionSetNode, targetObject: any, location: (string | number)[]) => {
      const typename = targetObject.__typename;
      if (!typename) {
        return null;
      }
      const objectId = targetObject.id ?? [operationId, ...location].join('/');
      const id = `${typename}:${objectId}`;
      let base: NormalizedDataRecord;
      if (this._normalizedData[id]) {
        base = this._normalizedData[id];
      } else {
        base = {
          __typename: typename,
        };
        this._normalizedData[id] = base;
      }
      selectionSet.selections.forEach(selection => {
        if (selection.kind === 'Field') {
          const fieldName = selection.name.value;
          const value = targetObject[fieldName];
          if (selection.selectionSet) {
            if (Array.isArray(value)) {
              base[fieldName] = value.map((v, i) => {
                return writeSelectionData(selection.selectionSet!, v, [...location, fieldName, i]);
              });
            } else if (value != null) {
              base[fieldName] = writeSelectionData(selection.selectionSet, value, [...location, fieldName]);
            }
          } else {
            base[fieldName] = value;
          }
        } else if (selection.kind === 'FragmentSpread') {
          const fragmentDef = fragmentMap.get(selection.name.value);
          if (!fragmentDef) {
            throw new Error(`cannot find fragment definition for ${selection.name.value}`);
          }
          writeSelectionData(fragmentDef.selectionSet, targetObject, location);
        }
      });
      const ref: NodeReference = {
        __ref: true,
        id: objectId,
        type: typename,
      };
      return ref;
    };
    const selectionSet = queryAstNode.selectionSet;
    const queryRef = writeSelectionData(selectionSet, data, []);
    if (queryRef) {
      this._operationResults[operationId] = `${queryRef.type}:${queryRef.id}`;
    }
  }
}
