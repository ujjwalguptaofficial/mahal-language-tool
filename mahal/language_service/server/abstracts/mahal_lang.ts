import { CompletionList, Hover } from "vscode-languageserver-protocol/node";
import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { DocManager } from "../managers";

export abstract class MahalLang {

    constructor(
        private docManager: DocManager
    ) {

    }

    protected getDoc(document: TextDocument) {
        return this.docManager.getEmbeddedDocument(
            document.uri,
            this.id
        )
    }

    abstract id: string;
    abstract doComplete(document: TextDocument, position: Position): Promise<CompletionList>;
    abstract doHover(document: TextDocument, position: Position): Hover;
}