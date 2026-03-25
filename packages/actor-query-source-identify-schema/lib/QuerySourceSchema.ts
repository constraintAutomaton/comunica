import { ActionContextKey } from '@comunica/core';
import type { QueryEngine } from '@comunica/query-sparql-rdfjs-lite';
import type {
  BindingsStream,
  FragmentSelectorShape,
  IActionContext,
  IQuerySource,
} from '@comunica/types';
import type { Algebra } from '@comunica/utils-algebra';
import type * as RDF from '@rdfjs/types';
import type { AsyncIterator } from 'asynciterator';

import { RdfStore } from 'rdf-stores';
import type { ISummary } from 'shex_to_summary';

export const KeysSchemaSource = {
  summary: new ActionContextKey<ISummary>(
    '@comunica/actor-query-source-identify-schema:summary',
  ),
};

export function isISummary(value: unknown): value is ISummary {
  return (
    typeof value === 'object' &&
    value !== null &&
    'statements' in value &&
    Array.isArray((<ISummary>value).statements) &&
    'unionStatement' in value &&
    Array.isArray((<ISummary>value).unionStatement) &&
    'constraints' in value &&
    (<ISummary>value).constraints instanceof Map
  );
}

export class QuerySourceSchema implements IQuerySource {
  private readonly stores: RDF.Store[];

  public constructor(
    summary: ISummary,
    public readonly referenceValue: string,
    private readonly queryEngine: QueryEngine,
  ) {
    this.stores = QuerySourceSchema.generateStores(summary);
  }

  public async getSelectorShape(
    _context: IActionContext,
  ): Promise<FragmentSelectorShape> {
    return {
      type: 'operation',
      operation: { operationType: 'wildcard' },
    };
  }

  public async getFilterFactor(_context: IActionContext): Promise<number> {
    return 1;
  }

  public async queryBoolean(
    operation: Algebra.Ask,
    _context: IActionContext,
  ): Promise<boolean> {
    for (const store of this.stores) {
      const result = await this.queryEngine.queryBoolean(operation, {
        sources: [ store ],
      });
      if (result) {
        return true;
      }
    }
    return false;
  }

  public static generateStores(
    node: ISummary,
    parentQuads: RDF.Quad[] = [],
  ): RdfStore[] {
    const allQuads = [ ...parentQuads, ...node.statements ];
    // Summary is empty so we return an empty store
    if (
      node.statements.length === 0 &&
      node.unionStatement.length === 0 &&
      node.constraints.size === 0 &&
      allQuads.length === 0
    ) {
      return [];
    }
    const stores: RdfStore[] = [];

    if (node.unionStatement.length === 0) {
      const mainStore = RdfStore.createDefault();
      for (const quad of allQuads) {
        mainStore.addQuad(quad);
      }
      if (mainStore.size > 0) {
        stores.push(mainStore);
      }
    }

    for (const child of node.unionStatement) {
      stores.push(...this.generateStores(child, allQuads));
    }

    return stores;
  }

  public queryBindings(
    _operation: Algebra.Operation,
    _context: IActionContext,
  ): BindingsStream {
    return this.methodNotSupported(this.queryBindings.name);
  }

  public queryQuads(
    _operation: Algebra.Operation,
    _context: IActionContext,
  ): AsyncIterator<RDF.Quad> {
    return this.methodNotSupported(this.queryQuads.name);
  }

  public queryVoid(
    _operation: Algebra.Operation,
    _context: IActionContext,
  ): Promise<void> {
    return this.methodNotSupported(this.queryVoid.name);
  }

  private methodNotSupported(methodName: string): never {
    throw new Error(
      `${QuerySourceSchema.name} does not supports ${methodName}`,
    );
  }

  public toString(): string {
    return `QuerySourceSchema(summary_url:${this.referenceValue})`;
  }
}
