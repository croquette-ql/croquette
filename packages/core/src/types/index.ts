import type { DocumentNode } from 'graphql';

export interface OperationIdGenerator {
  getOperationId({ query, variables }: { query: DocumentNode; variables: any }): string;
}
