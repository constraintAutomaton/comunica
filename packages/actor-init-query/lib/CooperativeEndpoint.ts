import { IMessage, IQueryMessage, MessageKind } from "@comunica/bus-inter-engine-communication";
import { request, createServer } from 'http';
import { QueryEngineFactory } from '..';

export class CommunicationEndpoint {
    private sparqlEngine: Promise<QueryEngineFactory>|undefined = undefined;

    public readonly context: any;
    public readonly timeout: number;

    public constructor(communicationServerAddress: string) {
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
                try {
                    const message = JSON.parse(body)
                    if (!isIQueryMessage(message)) {
                        console.warn(`${JSON.stringify(message)} is not a supported message`);
                    }
                    this.sparqlEngine = new QueryEngineFactory().create({});
                } catch (error) {
                    console.error(error);
                }

            });
        });

        server.on('error', (err) => {
            throw err;
        });
        console.log(`we are listenning to port ${communicationServerAddress}`)
        server.listen(communicationServerAddress)
    }
}

function isIMessage(object: any): object is IMessage {
    return 'kind' in object;
}
function isIQueryMessage(object: any): object is IQueryMessage {
    if (!isIMessage(object)) {
        return false
    }
    return object.kind === MessageKind.Query
}