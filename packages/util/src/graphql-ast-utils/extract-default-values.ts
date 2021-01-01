import type { OperationDefinitionNode } from 'graphql';
import { resolveValueNode } from './resolve-value-node';

export function extractDefaultValues(operationDefinition: OperationDefinitionNode): Record<string, any> {
  if (!operationDefinition.variableDefinitions) {
    return {};
  }
  const variableDefinitions = operationDefinition.variableDefinitions;
  return variableDefinitions.reduce((acc, variableDefinition) => {
    if (variableDefinition.defaultValue) {
      const value = resolveValueNode(variableDefinition.defaultValue, {});
      return { ...acc, [variableDefinition.variable.name.value]: value };
    } else {
      return acc;
    }
  }, {} as Record<string, any>);
}
