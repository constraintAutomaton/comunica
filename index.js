const communica = require("@comunica/query-sparql");
const log = require("@comunica/logger-pretty");

const a_vendor = (vendorId) => {
  return {
    'type': 'sparql',
    'value': `http://localhost:8890/sparql/?default-graph-uri=http://www.vendor${vendorId}.fr/`
  }
};

const a_rating = (rantingId) => {
  return {
    'type': 'sparql',
    'value': `http://localhost:8890/sparql/?default-graph-uri=http://www.ratingsite${rantingId}.fr/`
  }
}

const all_rating = (max_rating) => {
  const sources = [];
  for (let rantingId = 0; rantingId < max_rating; rantingId++) {
    sources.push(
      a_rating(rantingId)
    )
  }
  return sources
}

const all_vendors = (max_vendor) => {
  if (max_vendor == 0) {
    return [
      {
        'type': 'sparql',
        'value': `http://localhost:8890/sparql/`
      }
    ]
  }
  const sources = [];
  for (let vendorId = 0; vendorId < max_vendor; vendorId++) {
    sources.push(
      a_vendor(vendorId)
    )
  }
  return sources
}

let query = `
PREFIX bsbm-inst: <http://www4.wiwiss.fu-berlin.de/bizer/bsbm/v01/instances/>
PREFIX bsbm: <http://www4.wiwiss.fu-berlin.de/bizer/bsbm/v01/vocabulary/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX owl: <http://www.w3.org/2002/07/owl#>

SELECT ?label ?comment ?producer ?ProductFeatureLabel ?propertyTextual1 ?propertyTextual2 ?propertyTextual3 ?propertyNumeric1 ?propertyNumeric2 ?propertyTextual4 ?propertyTextual5 ?propertyNumeric4  WHERE {
    # const bsbm:Product116212
    ?localProduct owl:sameAs bsbm:Product116212 .
    ?localProduct rdfs:label ?label .
    ?localProduct rdfs:comment ?comment .
    ?localProduct bsbm:producer ?p .
    ?p rdfs:label ?producer .
    #?localProduct dc:publisher ?p . 
    ?localProduct bsbm:productFeature ?localProductFeature1 .
    ?localProductFeature1 owl:sameAs ?ProductFeature1 .
    ?localProductFeature1 rdfs:label ?ProductFeatureLabel .
    ?localProduct bsbm:productPropertyTextual1 ?propertyTextual1 .
    ?localProduct bsbm:productPropertyTextual2 ?propertyTextual2 .
    ?localProduct bsbm:productPropertyTextual3 ?propertyTextual3 .
    ?localProduct bsbm:productPropertyNumeric1 ?propertyNumeric1 .
    ?localProduct bsbm:productPropertyNumeric2 ?propertyNumeric2 .
    OPTIONAL { ?localProduct bsbm:productPropertyTextual4 ?propertyTextual4 }
    OPTIONAL { ?localProduct bsbm:productPropertyTextual5 ?propertyTextual5 }
    OPTIONAL { ?localProduct bsbm:productPropertyNumeric4 ?propertyNumeric4 }
}
`

const max_vendor = 25;
const max_rating = 1;

const sources = all_vendors(max_vendor)//.concat(all_rating(max_rating));
//all_vendors(max_vendor).concat(all_rating(max_rating));

const start = Date.now();

/** 
new communica.QueryEngineFactory().create({ configPath: './engines/config-query-sparql/config/config-default.json' }).then(
  (engine) => {
    engine.explain(query, {
      sources: sources,
    }, 'physical').then((queryPlan) => {
      console.log(JSON.stringify(queryPlan));

    })
  });
*/


new communica.QueryEngineFactory().create({ configPath: './engines/config-query-sparql/config/config-default.json' }).then(
  (engine) => {
    engine.queryBindings(query, {
      sources: sources,
      lenient: true,
      //log: new log.LoggerPretty({ level: 'debug' }),
    },'physical')
      .then((bindingsStream) => {
      bindingsStream.on('data', (binding) => {
        console.log(binding.toString());
      });
      bindingsStream.on('end', () => {
        const end = Date.now();
        console.log(`Execution time: ${end - start} ms`);
      });

    });
  }
);
// with inference: 35913, 37565, 38436, 38489, 36012=> avg 37 283
// ratio not calculated 95.362318840579

// without inference: 35744, 35831, 36427, 41935, 41183 => 38 224
// ratio not calculated: 86.37681159420289



// execution time with inferences: 36555 ms
//execution time without inferences: 40223 ms


// Query 2 | With 2 vendors working  almost instant | with 25 vendors execution time: 61670 ms | with 50 vendors execution time: 121069 or fail

// Query 3 | With 2 vendors does't work

// Query 10 | instant result with 1 | with 2 work in 68675ms
// Query 4 | With 
// Query 6 WORKING
/**
 * PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX rev: <http://purl.org/stuff/rev#>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX bsbm: <http://www4.wiwiss.fu-berlin.de/bizer/bsbm/v01/vocabulary/>
PREFIX bsbm-export: <http://www4.wiwiss.fu-berlin.de/bizer/bsbm/v01/vocabulary/export/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX owl: <http://www.w3.org/2002/07/owl#>

SELECT * WHERE { 
    # const <http://www.vendor6.fr/Offer846>
    <http://www.vendor6.fr/Offer846> bsbm:product ?productURI .
    ?productURI owl:sameAs ?ProductXYZ . 
    ?productURI rdfs:label ?productlabel .
    <http://www.vendor6.fr/Offer846> bsbm:vendor ?vendorURI .
    ?vendorURI rdfs:label ?vendorname .
    ?vendorURI foaf:homepage ?vendorhomepage .
    <http://www.vendor6.fr/Offer846> bsbm:offerWebpage ?offerURL .
    <http://www.vendor6.fr/Offer846> bsbm:price ?price .
    <http://www.vendor6.fr/Offer846> bsbm:deliveryDays ?deliveryDays .
    <http://www.vendor6.fr/Offer846> bsbm:validTo ?validTo 
}
 */

/**
 * 
 */