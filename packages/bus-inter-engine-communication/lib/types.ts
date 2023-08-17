/**
 * A type of message
 */
export enum MessageType {
    String,
}

/**
 * A Message
 */
export interface IMessage {
    types: MessageType,
    payload: any,
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
export enum ChannelType {
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