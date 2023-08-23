import { DataSources } from "@comunica/types"

/**
 * A kind of message
 */
export enum MessageKind {
    String,
    Query
}

/**
 * A Message
 */
export interface IMessage {
    kind: MessageKind,
}

export interface IQueryMessage extends IMessage{
    query: string,
    datasources: DataSources,
    context: any
}

/**
 * A channel to communicate
 */
export interface IChannel {
    name: string,
    address: string[]
}
/**
 * A type of channel
 */
export enum ChannelKind {
    /**
     * A single peer engine
     */
    Peer,
    /**
     * A group of peer engines
     */
    Group,
    /**
     * All the peer engines the source engine knows
     */
    Broadcast,
}