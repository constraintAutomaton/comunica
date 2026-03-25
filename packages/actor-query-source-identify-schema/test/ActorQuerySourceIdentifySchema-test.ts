import { ActorQuerySourceIdentify } from '@comunica/bus-query-source-identify';
import { ActionContext, Bus } from '@comunica/core';
import type * as RDF from '@rdfjs/types';
import { DataFactory } from 'rdf-data-factory';
import type { ISummary } from 'shex_to_summary';
import '@comunica/utils-jest';
import { ActorQuerySourceIdentifySchema, KeysSchemaSource, QuerySourceSchema } from '../lib';

const DF = new DataFactory();

function makeTriple(s: string, p: string, o: string): RDF.Quad {
  return DF.quad(DF.namedNode(s), DF.namedNode(p), DF.namedNode(o));
}

const SOURCE_URL = 'http://ex/source';
const EX_TRIPLE = makeTriple('http://ex/s', 'http://ex/p', 'http://ex/o');

const LEAF_SUMMARY: ISummary = {
  statements: [ EX_TRIPLE ],
  unionStatement: [],
  constraints: new Map(),
};

const SOURCE_CONTEXT = new ActionContext().set(KeysSchemaSource.summary, LEAF_SUMMARY);

describe('ActorQuerySourceIdentifySchema', () => {
  let bus: any;

  beforeEach(() => {
    bus = new Bus({ name: 'bus' });
  });

  describe('The ActorQuerySourceIdentifySchema module', () => {
    it('should be a function', () => {
      expect(ActorQuerySourceIdentifySchema).toBeInstanceOf(Function);
    });

    it('should be an ActorQuerySourceIdentifySchema constructor', () => {
      expect(new ActorQuerySourceIdentifySchema({ name: 'actor', bus }))
        .toBeInstanceOf(ActorQuerySourceIdentifySchema);
      expect(new ActorQuerySourceIdentifySchema({ name: 'actor', bus }))
        .toBeInstanceOf(ActorQuerySourceIdentify);
    });
  });

  describe('An ActorQuerySourceIdentifySchema instance', () => {
    let actor: ActorQuerySourceIdentifySchema;

    beforeEach(() => {
      actor = new ActorQuerySourceIdentifySchema({ name: 'actor', bus });
    });

    describe('test', () => {
      it('should pass for a string URL with summary in source context', async() => {
        await expect(actor.test({
          querySourceUnidentified: { value: SOURCE_URL, context: SOURCE_CONTEXT },
          context: new ActionContext(),
        })).resolves.toPassTestVoid();
      });

      it('should pass for type schema with string URL and summary in context', async() => {
        await expect(actor.test({
          querySourceUnidentified: { type: 'schema', value: SOURCE_URL, context: SOURCE_CONTEXT },
          context: new ActionContext(),
        })).resolves.toPassTestVoid();
      });

      it('should fail for a wrong type', async() => {
        await expect(actor.test({
          querySourceUnidentified: { type: 'sparql', value: SOURCE_URL, context: SOURCE_CONTEXT },
          context: new ActionContext(),
        })).resolves.toFailTest('actor requires a query source with schema type.');
      });

      it('should fail when value is not a string', async() => {
        await expect(actor.test({
          querySourceUnidentified: { value: <any>LEAF_SUMMARY },
          context: new ActionContext(),
        })).resolves.toFailTest('actor requires a string URL as value.');
      });

      it('should fail when summary is missing from source context', async() => {
        await expect(actor.test({
          querySourceUnidentified: { value: SOURCE_URL },
          context: new ActionContext(),
        })).resolves.toFailTest('actor requires a summary in the source context.');
      });
    });

    describe('run', () => {
      it('should return a QuerySourceSchema', async() => {
        const ret = await actor.run({
          querySourceUnidentified: { value: SOURCE_URL, context: SOURCE_CONTEXT },
          context: new ActionContext(),
        });
        expect(ret.querySource.source).toBeInstanceOf(QuerySourceSchema);
      });

      it('should set the referenceValue to the source URL', async() => {
        const ret = await actor.run({
          querySourceUnidentified: { value: SOURCE_URL, context: SOURCE_CONTEXT },
          context: new ActionContext(),
        });
        expect((<QuerySourceSchema> ret.querySource.source).referenceValue).toBe(SOURCE_URL);
      });

      it('should use provided source context on the query source', async() => {
        const ret = await actor.run({
          querySourceUnidentified: { value: SOURCE_URL, context: SOURCE_CONTEXT },
          context: new ActionContext(),
        });
        expect(ret.querySource.context).toBe(SOURCE_CONTEXT);
      });

      it('should throw when value is not a string', async() => {
        await expect(actor.run({
          querySourceUnidentified: { value: <any>LEAF_SUMMARY },
          context: new ActionContext(),
        })).rejects.toThrow('actor requires a string URL as value.');
      });

      it('should throw when summary in context is not a valid ISummary', async() => {
        const invalidContext = new ActionContext().set(KeysSchemaSource.summary, <any>'not-a-summary');
        await expect(actor.run({
          querySourceUnidentified: { value: SOURCE_URL, context: invalidContext },
          context: new ActionContext(),
        })).rejects.toThrow('actor received an invalid schema query source: summary missing from context.');
      });
    });
  });
});
