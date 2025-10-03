import { KeyReasoning } from '@comunica/context-entries';
import { LoggerBunyan, BunyanStreamProviderStdout } from '@comunica/logger-bunyan';
import { QueryEngineFactory } from '@comunica/query-sparql';
import { DataFactory } from 'rdf-data-factory';

const DF = new DataFactory();
// https://github.com/comunica/comunica/blob/7f2c7dbf5d957b0728af4065c2c6721c43e6aeae/packages/actor-query-operation-construct/lib/BindingsToQuadsIterator.ts#L53

const myEngine = await new QueryEngineFactory().create();

const query = `
SELECT * WHERE {
  ?s <http://www.w3.org/ns/pim/space#storage3> ?storage
}
`;

const streamProvider = new BunyanStreamProviderStdout({ level: 'debug' });
const loggerParams = {
  name: 'comunica',
  level: 'info',
  streamProviders: [ streamProvider ],
};
const logger = new LoggerBunyan(loggerParams);
const sameAs = DF.namedNode('http://www.w3.org/2002/07/owl#sameAs');

const debugRule = [
  DF.quad(
    DF.namedNode('http://www.w3.org/ns/pim/space#storage'),
    sameAs,
    DF.namedNode('http://www.w3.org/ns/pim/space#storage2'),
  ),
  DF.quad(
    DF.namedNode('http://www.w3.org/ns/pim/space#storage2'),
    sameAs,
    DF.namedNode('http://www.w3.org/ns/pim/space#storage3'),
  ),
];
const bindingsStream = await myEngine.queryBindings(query, {
  lenient: true,
  // Log: logger,
  [KeyReasoning.rules.name]: new Map([
    [ '*', debugRule ],
  ]),
  sources: [ 'https://solidbench.linkeddatafragments.org/pods/00000000000000000933/profile/card#me' ],

});

let i = 0;
bindingsStream.on('data', (binding) => {
  console.log(binding.toString());
  i += 1;
});
bindingsStream.on('end', () => {
  console.log(`there are ${i} results`);
});
bindingsStream.on('error', (error) => {
  console.error(error);
});
