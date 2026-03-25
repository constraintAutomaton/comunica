import { ActionContext } from '@comunica/core';
import { QueryEngine } from '@comunica/query-sparql-rdfjs-lite';
import { AlgebraFactory } from '@comunica/utils-algebra';
import type * as RDF from '@rdfjs/types';
import { DataFactory } from 'rdf-data-factory';
import type { ISummary } from 'shex_to_summary';
import { isISummary, QuerySourceSchema } from '../lib/QuerySourceSchema';

const DF = new DataFactory();
const AF = new AlgebraFactory(<any>DF);

const SOURCE_URL = 'http://ex/source';

function makeTriple(s: string, p: string, o: string): RDF.Quad {
  return DF.quad(DF.namedNode(s), DF.namedNode(p), DF.namedNode(o));
}

function makeAsk(s: string, p: string, o: string) {
  return AF.createAsk(AF.createBgp([ AF.createPattern(DF.namedNode(s), DF.namedNode(p), DF.namedNode(o)) ]));
}

const EX_TRIPLE = makeTriple('http://ex/s', 'http://ex/p', 'http://ex/o');
const EX_TRIPLE_2 = makeTriple('http://ex/s2', 'http://ex/p2', 'http://ex/o2');
const EX_ASK_MATCH = makeAsk('http://ex/s', 'http://ex/p', 'http://ex/o');
const EX_ASK_NO_MATCH = makeAsk('http://ex/s', 'http://ex/p', 'http://ex/x');

const LEAF_SUMMARY: ISummary = {
  statements: [ EX_TRIPLE ],
  unionStatement: [],
  constraints: new Map(),
};

const EMPTY_SUMMARY: ISummary = {
  statements: [],
  unionStatement: [],
  constraints: new Map(),
};

describe(isISummary.name, () => {
  it('returns true for a valid ISummary', () => {
    expect(isISummary(LEAF_SUMMARY)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isISummary(null)).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isISummary('http://ex/')).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isISummary(42)).toBe(false);
  });

  it('returns false when statements is missing', () => {
    expect(isISummary({ unionStatement: [], constraints: new Map() })).toBe(false);
  });

  it('returns false when statements is not an array', () => {
    expect(isISummary({ statements: 'foo', unionStatement: [], constraints: new Map() })).toBe(false);
  });

  it('returns false when unionStatement is missing', () => {
    expect(isISummary({ statements: [], constraints: new Map() })).toBe(false);
  });

  it('returns false when unionStatement is not an array', () => {
    expect(isISummary({ statements: [], unionStatement: 'foo', constraints: new Map() })).toBe(false);
  });

  it('returns false when constraints is missing', () => {
    expect(isISummary({ statements: [], unionStatement: []})).toBe(false);
  });

  it('returns false when constraints is not a Map', () => {
    expect(isISummary({ statements: [], unionStatement: [], constraints: {}})).toBe(false);
  });
});

describe(QuerySourceSchema.name, () => {
  const ctx = new ActionContext();
  let queryEngine: QueryEngine;

  beforeEach(() => {
    queryEngine = new QueryEngine();
  });

  describe('constructor', () => {
    it('sets referenceValue to the provided url', () => {
      const source = new QuerySourceSchema(LEAF_SUMMARY, SOURCE_URL, queryEngine);
      expect(source.referenceValue).toBe(SOURCE_URL);
    });
  });

  describe(QuerySourceSchema.prototype.getSelectorShape.name, () => {
    it('returns a wildcard operation shape', async() => {
      const source = new QuerySourceSchema(LEAF_SUMMARY, SOURCE_URL, queryEngine);
      await expect(source.getSelectorShape(ctx)).resolves.toEqual({
        type: 'operation',
        operation: { operationType: 'wildcard' },
      });
    });
  });

  describe(QuerySourceSchema.prototype.getFilterFactor.name, () => {
    it('returns 1', async() => {
      const source = new QuerySourceSchema(LEAF_SUMMARY, SOURCE_URL, queryEngine);
      await expect(source.getFilterFactor(ctx)).resolves.toBe(1);
    });
  });

  describe(QuerySourceSchema.prototype.toString.name, () => {
    it('returns QuerySourceSchema', () => {
      const source = new QuerySourceSchema(LEAF_SUMMARY, SOURCE_URL, queryEngine);
      expect(source.toString()).toBe(`QuerySourceSchema(summary_url:${SOURCE_URL})`);
    });
  });

  describe(QuerySourceSchema.generateStores.name, () => {
    it('returns one store for a leaf node with quads', () => {
      const stores = QuerySourceSchema.generateStores(LEAF_SUMMARY);
      expect(stores).toHaveLength(1);
      expect(stores[0].size).toBe(1);
      expect(stores[0].getQuads()).toEqual([ EX_TRIPLE ]);
    });

    it('returns one empty store for a leaf node with no quads', () => {
      const stores = QuerySourceSchema.generateStores(EMPTY_SUMMARY);
      expect(stores).toHaveLength(0);
    });

    it('returns one store per leaf child for a union node', () => {
      const summary: ISummary = {
        statements: [],
        unionStatement: [ LEAF_SUMMARY, EMPTY_SUMMARY ],
        constraints: new Map(),
      };
      const stores = QuerySourceSchema.generateStores(summary);
      expect(stores).toHaveLength(1);
    });

    it('propagates parent quads into each child store', () => {
      const summary: ISummary = {
        statements: [ EX_TRIPLE ],
        unionStatement: [ EMPTY_SUMMARY ],
        constraints: new Map(),
      };
      const stores = QuerySourceSchema.generateStores(summary);
      expect(stores).toHaveLength(1);
      expect(stores[0].size).toBe(1);
      expect(stores[0].getQuads()).toEqual([ EX_TRIPLE ]);
    });

    it('combines parent and child quads in each child store', () => {
      const child: ISummary = { statements: [ EX_TRIPLE_2 ], unionStatement: [], constraints: new Map() };
      const summary: ISummary = {
        statements: [ EX_TRIPLE ],
        unionStatement: [ child ],
        constraints: new Map(),
      };
      const stores = QuerySourceSchema.generateStores(summary);
      expect(stores).toHaveLength(1);
      expect(stores[0].size).toBe(2);
      expect(stores[0].getQuads()).toEqual(expect.arrayContaining([ EX_TRIPLE, EX_TRIPLE_2 ]));
    });

    it('produces one store per non-empty union branch with correct content', () => {
      const child1: ISummary = { statements: [ EX_TRIPLE ], unionStatement: [], constraints: new Map() };
      const child2: ISummary = { statements: [ EX_TRIPLE_2 ], unionStatement: [], constraints: new Map() };
      const root: ISummary = { statements: [], unionStatement: [ child1, child2 ], constraints: new Map() };
      const stores = QuerySourceSchema.generateStores(root);
      expect(stores).toHaveLength(2);
      expect(stores[0].getQuads()).toEqual([ EX_TRIPLE ]);
      expect(stores[1].getQuads()).toEqual([ EX_TRIPLE_2 ]);
    });

    it('produces the correct number of stores for deeply nested summaries', () => {
      const leaf1: ISummary = { statements: [ EX_TRIPLE ], unionStatement: [], constraints: new Map() };
      const leaf2: ISummary = { statements: [ EX_TRIPLE_2 ], unionStatement: [], constraints: new Map() };
      const mid: ISummary = { statements: [], unionStatement: [ leaf1, leaf2 ], constraints: new Map() };
      const root: ISummary = { statements: [], unionStatement: [ mid ], constraints: new Map() };
      const stores = QuerySourceSchema.generateStores(root);
      expect(stores).toHaveLength(2);
    });

    it('each leaf store in deep nesting contains all ancestor quads', () => {
      const ancestorQuad = makeTriple('http://ex/anc', 'http://ex/p', 'http://ex/o');
      const leaf: ISummary = { statements: [ EX_TRIPLE ], unionStatement: [], constraints: new Map() };
      const root: ISummary = {
        statements: [ ancestorQuad ],
        unionStatement: [ leaf ],
        constraints: new Map(),
      };
      const stores = QuerySourceSchema.generateStores(root);
      expect(stores[0].size).toBe(2);
      expect(stores[0].getQuads()).toEqual(expect.arrayContaining([ ancestorQuad, EX_TRIPLE ]));
    });
  });

  describe(QuerySourceSchema.prototype.queryBoolean.name, () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('returns true when the leaf store matches', async() => {
      const source = new QuerySourceSchema(LEAF_SUMMARY, SOURCE_URL, queryEngine);
      await expect(source.queryBoolean(EX_ASK_MATCH, ctx)).resolves.toBe(true);
    });

    it('returns false when the leaf store does not match', async() => {
      const source = new QuerySourceSchema(LEAF_SUMMARY, SOURCE_URL, queryEngine);
      await expect(source.queryBoolean(EX_ASK_NO_MATCH, ctx)).resolves.toBe(false);
    });

    it('returns false for an empty summary', async() => {
      const source = new QuerySourceSchema(EMPTY_SUMMARY, SOURCE_URL, queryEngine);
      await expect(source.queryBoolean(EX_ASK_MATCH, ctx)).resolves.toBe(false);
    });

    it('returns true when the first union branch matches', async() => {
      const summary: ISummary = {
        statements: [],
        unionStatement: [ LEAF_SUMMARY, EMPTY_SUMMARY ],
        constraints: new Map(),
      };
      const source = new QuerySourceSchema(summary, SOURCE_URL, queryEngine);
      await expect(source.queryBoolean(EX_ASK_MATCH, ctx)).resolves.toBe(true);
    });

    it('returns true when the second union branch matches', async() => {
      const summary: ISummary = {
        statements: [],
        unionStatement: [ EMPTY_SUMMARY, LEAF_SUMMARY ],
        constraints: new Map(),
      };
      const source = new QuerySourceSchema(summary, SOURCE_URL, queryEngine);
      await expect(source.queryBoolean(EX_ASK_MATCH, ctx)).resolves.toBe(true);
    });

    it('returns false when no union branch matches', async() => {
      const summary: ISummary = {
        statements: [],
        unionStatement: [ EMPTY_SUMMARY, EMPTY_SUMMARY ],
        constraints: new Map(),
      };
      const source = new QuerySourceSchema(summary, SOURCE_URL, queryEngine);
      await expect(source.queryBoolean(EX_ASK_NO_MATCH, ctx)).resolves.toBe(false);
    });

    it('inherits parent statements into union branches', async() => {
      const summary: ISummary = {
        statements: [ EX_TRIPLE ],
        unionStatement: [ EMPTY_SUMMARY ],
        constraints: new Map(),
      };
      const source = new QuerySourceSchema(summary, SOURCE_URL, queryEngine);
      await expect(source.queryBoolean(EX_ASK_MATCH, ctx)).resolves.toBe(true);
    });

    it('propagates errors from the query engine', async() => {
      jest.spyOn(queryEngine, 'queryBoolean').mockRejectedValueOnce(new Error('engine failure'));
      const source = new QuerySourceSchema(LEAF_SUMMARY, SOURCE_URL, queryEngine);
      await expect(source.queryBoolean(EX_ASK_MATCH, ctx)).rejects.toThrow('engine failure');
    });
  });

  describe('unsupported methods', () => {
    let source: QuerySourceSchema;

    beforeEach(() => {
      source = new QuerySourceSchema(LEAF_SUMMARY, SOURCE_URL, queryEngine);
    });

    it('queryBindings throws with correct message', () => {
      expect(() => source.queryBindings(AF.createBgp([
        AF.createPattern(DF.namedNode('http://ex/s'), DF.namedNode('http://ex/p'), DF.namedNode('http://ex/o')),
      ]), ctx)).toThrow('QuerySourceSchema does not supports queryBindings');
    });

    it('queryQuads throws with correct message', () => {
      expect(() => source.queryQuads(<any>EX_ASK_MATCH, ctx))
        .toThrow('QuerySourceSchema does not supports queryQuads');
    });

    it('queryVoid throws with correct message', () => {
      expect(() => source.queryVoid(<any>EX_ASK_MATCH, ctx))
        .toThrow('QuerySourceSchema does not supports queryVoid');
    });
  });
});
