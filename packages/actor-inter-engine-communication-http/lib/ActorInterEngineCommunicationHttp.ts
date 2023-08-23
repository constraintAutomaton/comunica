import {
  ActorInterEngineCommunication,
  IActionInterEngineCommunication,
  IActorInterEngineCommunicationOutput,
  IActorInterEngineCommunicationArgs,
  IQueryMessage
} from '@comunica/bus-inter-engine-communication';
import { IActorArgs, IActorTest } from '@comunica/core';
import { request, createServer } from 'http';
import { resolve } from 'path';

/**
 * A Comunica actor to send message to another engine using the SPARQL protocol.
 */
export class ActorInterEngineCommunicationHttp extends ActorInterEngineCommunication {
  public constructor(args: IActorInterEngineCommunicationArgs) {
    super(args);
    const server = createServer();

    server.on('request', (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });

      res.end(JSON.stringify({
        data: 'Hello World!',
      }));

      const bodyByte: Array<Uint8Array> = [];
      req.on('data', (chunk) => {
        bodyByte.push(chunk);
      })

      req.on('end', () => {
        const body = Buffer.concat(bodyByte).toString();
        console.log(body);

      });
    });

    server.on('error', (err) => {
      throw err;
    });

    server.listen(8099)
  }

  public async test(action: IActionInterEngineCommunication): Promise<IActorTest> {
    return true; // TODO implement
  }

  public async run(action: IActionInterEngineCommunication): Promise<IActorInterEngineCommunicationOutput> {
    return true; // TODO implement
  }

  public async send(message: IQueryMessage, channelName: string): Promise<undefined | Error> {
    return new Promise((resolve, reject) => {
      const addresses = this.channels.get(channelName);
      if (addresses === undefined) {
        return reject(new ReferenceError('the channel does not exist'))
      }
      const stringMessage = JSON.stringify(message);
      const option = {
        method: 'POST',
        body: stringMessage,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(stringMessage),
        },
      };

      for (const address of addresses.address) {
        request(address, option, (res) => {
          res.on('error', (err) => {
            reject(err);
          });
        });

      }
      resolve(undefined);
    });
  }

  public async recv(channelName: string, timeout: number | undefined): Promise<IQueryMessage | Error> {
    return new Promise((resolve, reject) => {

    });
  }
}
