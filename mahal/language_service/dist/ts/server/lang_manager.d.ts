import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position, TextDocumentIdentifier, TextDocuments } from 'vscode-languageserver/node';
import { MahalLang } from './abstracts';
import { ILangCache, IMahalDocCache } from './interfaces';
export declare class LangManager {
    documents: TextDocuments<TextDocument>;
    langs: {
        [id: string]: MahalLang;
    };
    documentCache: ILangCache<IMahalDocCache>;
    constructor(connection: any);
    doComplete(docIdentifier: TextDocumentIdentifier, position: Position): Promise<import("vscode-languageserver-types").CompletionList>;
}
