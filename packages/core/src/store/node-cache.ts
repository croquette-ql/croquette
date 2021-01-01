import type {
  DocumentNode,
  OperationDefinitionNode,
  SelectionSetNode,
  FragmentDefinitionNode,
  DirectiveNode,
} from 'graphql';
import { extractDefaultValues, resolveValueNode } from '@croquette/util';
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

type NodePath = (string | number)[];

type selectionVisitContext = {
  readonly operationId: string;
  readonly fragmentMap: Map<string, FragmentDefinitionNode>;
  readonly mergedVariables: Record<string, any>;
};

export type NodeCacheCreateOptions = {
  initialData?: {
    operationResults: Record<string, string>;
    normalizedData: NormalizedData;
  };
  idGenerator?: OperationIdGenerator;
};

export type CacheResult = {
  data: any;
  missingDataLocations: NodePath;
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
    const missingDataLocations: NodePath = [];

    const record = this._normalizedData[operationResultKey];
    const selectionSet = queryAstNode.selectionSet;
    const mergedVariables = { ...extractDefaultValues(queryAstNode), ...variables };
    const data = this._getSelectionData(selectionSet, record, missingDataLocations, {
      operationId,
      fragmentMap,
      mergedVariables,
    });

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
    const selectionSet = queryAstNode.selectionSet;
    const mergedVariables = { ...extractDefaultValues(queryAstNode), ...variables };
    const queryRef = this._writeSelectionData(selectionSet, data, [], {
      operationId,
      fragmentMap,
      mergedVariables,
    });
    if (queryRef) {
      this._operationResults[operationId] = `${queryRef.type}:${queryRef.id}`;
    }
  }

  private _getSelectionData(
    selectionSet: SelectionSetNode,
    targetRecord: any,
    missingDataLocations: NodePath,
    context: selectionVisitContext,
  ) {
    let ret: any = {};
    selectionSet.selections.forEach(selection => {
      if (this._shouldBeSkipped(selection.directives, context)) {
        return;
      }
      if (selection.kind === 'Field') {
        const value = targetRecord[selection.name.value];
        if (selection.selectionSet) {
          if (isNodeReference(value)) {
            const nextRecord = this._normalizedData[`${value.type}:${value.id}`];
            ret[selection.name.value] = this._getSelectionData(
              selection.selectionSet,
              nextRecord,
              missingDataLocations,
              context,
            );
          } else if (Array.isArray(value)) {
            ret[selection.name.value] = value.map(v => {
              if (isNodeReference(v)) {
                const nextRecord = this._normalizedData[`${v.type}:${v.id}`];
                return this._getSelectionData(selection.selectionSet!, nextRecord, missingDataLocations, context);
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
        const fragmentDef = context.fragmentMap.get(selection.name.value);
        if (!fragmentDef) {
          throw new Error(`cannot find fragment definition for ${selection.name.value}`);
        }
        ret = {
          ...ret,
          ...this._getSelectionData(fragmentDef.selectionSet, targetRecord, missingDataLocations, context),
        };
      } else if (selection.kind === 'InlineFragment') {
        // TBD
      }
    });
    return ret;
  }

  private _writeSelectionData(
    selectionSet: SelectionSetNode,
    targetObject: any,
    location: NodePath,
    context: selectionVisitContext,
  ) {
    const typename = targetObject.__typename;
    if (!typename) {
      return null;
    }
    const objectId = targetObject.id ?? [context.operationId, ...location].join('/');
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
      if (this._shouldBeSkipped(selection.directives, context)) {
        return;
      }
      if (selection.kind === 'Field') {
        const fieldName = selection.name.value;
        const value = targetObject[fieldName];
        if (selection.selectionSet) {
          if (Array.isArray(value)) {
            base[fieldName] = value.map((v, i) => {
              return this._writeSelectionData(selection.selectionSet!, v, [...location, fieldName, i], context);
            });
          } else if (value != null) {
            base[fieldName] = this._writeSelectionData(
              selection.selectionSet,
              value,
              [...location, fieldName],
              context,
            );
          }
        } else {
          base[fieldName] = value;
        }
      } else if (selection.kind === 'FragmentSpread') {
        const fragmentDef = context.fragmentMap.get(selection.name.value);
        if (!fragmentDef) {
          throw new Error(`cannot find fragment definition for ${selection.name.value}`);
        }
        this._writeSelectionData(fragmentDef.selectionSet, targetObject, location, context);
      } else if (selection.kind === 'InlineFragment') {
        // TBD
      }
    });
    const ref: NodeReference = {
      __ref: true,
      id: objectId,
      type: typename,
    };
    return ref;
  }

  private _shouldBeSkipped(directives: ReadonlyArray<DirectiveNode> | undefined, context: selectionVisitContext) {
    if (!directives) return false;
    const getIf = (directieNode: DirectiveNode) => {
      const hit = directieNode?.arguments?.find(arg => arg.name.value === 'if');
      if (!hit) return false;
      return resolveValueNode(hit.value, context.mergedVariables);
    };
    const skipDirective = directives.find(d => d.name.value === 'skip');
    const includeDirective = directives.find(d => d.name.value === 'include');
    if (!skipDirective && !includeDirective) {
      return false;
    } else if (skipDirective && !includeDirective) {
      return getIf(skipDirective) === true;
    } else if (!skipDirective && includeDirective) {
      return getIf(includeDirective) === false;
    } else if (skipDirective && includeDirective) {
      // https://spec.graphql.org/June2018/#sec--include
      return !(getIf(skipDirective) === false && getIf(includeDirective) === true);
    } else {
      return false as never;
    }
  }
}
