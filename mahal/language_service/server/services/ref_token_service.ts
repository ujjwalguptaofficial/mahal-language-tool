import { Connection, Range } from "vscode-languageserver/node";

export class RefTokensService {
    constructor(private con: Connection) {

    }
    send(uri: string, tokens: Range[]) {
        this.con.sendNotification('$/refTokens', { uri, tokens });
    }
}