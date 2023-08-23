# Comunica Http Inter Engine Communication Actor

[![npm version](https://badge.fury.io/js/%40comunica%2Factor-inter-engine-communication-http.svg)](https://www.npmjs.com/package/@comunica/actor-inter-engine-communication-http)

A Comunica actor to send message to another engine using the SPARQL protocol.

This module is part of the [Comunica framework](https://github.com/comunica/comunica),
and should only be used by [developers that want to build their own query engine](https://comunica.dev/docs/modify/).

[Click here if you just want to query with Comunica](https://comunica.dev/docs/query/).

## Install

```bash
$ yarn add @comunica/actor-inter-engine-communication-http
```

## Configure

After installing, this package can be added to your engine's configuration as follows:
```text
{
  "@context": [
    ...
    "https://linkedsoftwaredependencies.org/bundles/npm/@comunica/actor-inter-engine-communication-http/^1.0.0/components/context.jsonld"  
  ],
  "actors": [
    ...
    {
      "@id": "urn:comunica:default:inter-engine-communication/actors#http",
      "@type": "ActorInterEngineCommunicationHttp"
    }
  ]
}
```

### Config Parameters

TODO: fill in parameters (this section can be removed if there are none)

* `someParam`: Description of the param
