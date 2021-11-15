import { CompletionList } from "vscode-languageserver-protocol/node";
import { Position, TextDocument } from "vscode-languageserver-textdocument";

export abstract class MahalLang {
    abstract id: string;
    abstract doComplete(document: TextDocument, position: Position): Promise<CompletionList>;
}