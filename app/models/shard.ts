class Shard {
    sessionId: string
    shardId: string
    websocket: WebSocket | null = null;

    constructor(sessionId:string,shardId:string,websocket:WebSocket) {
        this.sessionId = sessionId;
        this.shardId = shardId;
        this.websocket = websocket;
    }
}