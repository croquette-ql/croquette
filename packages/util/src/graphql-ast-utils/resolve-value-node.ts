import type { ValueNode } from 'graphql';

export function resolveValueNode(valueNode: ValueNode, definedVariables: Record<string, any>): any {
  switch (valueNode.kind) {
    case 'Variable': {
      const v = definedVariables[valueNode.name.value];
      if (!v) {
        throw new Error(`There is not defined variable whose name is "${valueNode.name.value}" in ${definedVariables}`);
      }
      return v;
    }
    case 'ListValue':
      return valueNode.values.map(v => resolveValueNode(v, definedVariables));
    case 'ObjectValue':
      return valueNode.fields.reduce((acc, field) => {
        return {
          ...acc,
          [field.name.value]: resolveValueNode(field.value, definedVariables),
        };
      }, {} as Record<string, any>);
    case 'StringValue':
    case 'EnumValue':
      return valueNode.value as string;
    case 'IntValue':
      return Number.parseInt(valueNode.value, 10);
    case 'FloatValue':
      return Number.parseFloat(valueNode.value);
    case 'BooleanValue':
      return valueNode.value;
    case 'NullValue':
      return null;
  }
}
