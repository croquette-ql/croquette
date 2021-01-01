import { parse, OperationDefinitionNode } from 'graphql';
import { extractDefaultValues } from './extract-default-values';

describe(extractDefaultValues, () => {
  it('should extract default values objects with query operation', () => {
    const query = `
      query MyQuery(
        $intValue: Int = 100,
        $floatValue: Float = 0.5,
        $stringValue: String = "hogefuga",
        $enum: MY_ENUM = ENUM,
        $boolValue: Boolean = false,
        $objValue: MY_INPUT_OBJ = { a: 1 },
        $listValue: MY_INPUT_LIST = [1],
        $nullValue: MY_NULLABLE_OBJ = null
      ) {
        __typename
      }
    `;
    const operationDefNode = parse(query).definitions[0]! as OperationDefinitionNode;
    const actual = extractDefaultValues(operationDefNode);
    expect(actual).toStrictEqual({
      intValue: 100,
      floatValue: 0.5,
      stringValue: 'hogefuga',
      enum: 'ENUM',
      boolValue: false,
      objValue: { a: 1 },
      listValue: [1],
      nullValue: null,
    });
  });
});
