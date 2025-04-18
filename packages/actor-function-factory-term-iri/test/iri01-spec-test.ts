import type { FuncTestTableConfig } from '@comunica/bus-function-factory/test/util';
import { runFuncTestTable } from '@comunica/bus-function-factory/test/util';
import { KeysInitQuery } from '@comunica/context-entries';
import { ActionContext } from '@comunica/core';
import { Notation } from '@comunica/utils-expression-evaluator/test/util/TestTable';
import { ActorFunctionFactoryTermIri } from '../lib';

describe('We should respect the iri01 spec', () => {
  const config: FuncTestTableConfig<object> = {
    registeredActors: [
      args => new ActorFunctionFactoryTermIri(args),
    ],
    config: new ActionContext().set(KeysInitQuery.baseIRI, 'http://example.org'),
    arity: 1,
    operation: '',
    notation: Notation.Function,
  };
  runFuncTestTable({
    ...config,
    operation: 'URI',
    testTable: `
      "uri" = http://example.org/uri
    `,
  });
  runFuncTestTable({
    ...config,
    operation: 'IRI',
    testTable: `
      "iri" = http://example.org/iri
    `,
  });
});

/**
 * RESULTS: iri01.srx
 *
 * <?xml version="1.0" encoding="utf-8"?>
 * <sparql xmlns="http://www.w3.org/2005/sparql-results#">
 * <head>
 *   <variable name="iri"/>
 *   <variable name="uri"/>
 * </head>
 * <results>
 *     <result>
 *       <binding name="uri"><uri>http://example.org/uri</uri></binding>
 *       <binding name="iri"><uri>http://example.org/iri</uri></binding>
 *     </result>
 * </results>
 * </sparql>
 *
 */
