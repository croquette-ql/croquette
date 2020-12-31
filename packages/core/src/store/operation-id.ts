import type { DocumentNode, OperationDefinitionNode } from 'graphql';

export class DefaultOperationIdGenerator {
  constructor() {}

  getOperationId({ query, variables }: { query: DocumentNode; variables: any }) {
    const hit = query.definitions.find(node => node.kind === 'OperationDefinition');
    if (!hit) {
      throw new Error('no operation definition');
    }
    const operationNode = hit as OperationDefinitionNode;
    if (!operationNode.name) {
      throw new Error('operation needs name');
    }
    const v = JSON.stringify(variables ?? {});
    return `${operationNode.name.value}/${v}`;
  }
}
