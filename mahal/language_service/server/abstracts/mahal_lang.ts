import { CompletionItem, Location, Range, CompletionList, Hover, DocumentHighlight } from "vscode-languageserver-protocol/node";
import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { SignatureHelp, SymbolInformation } from "vscode-languageserver/node";
import { ISemanticTokenData } from "../interfaces";
import { DocManager } from "../managers";

export abstract class MahalLang {

    constructor(
        protected docManager: DocManager
    ) {

    }

    protected getDoc(document: TextDocument) {
        return this.docManager.getEmbeddedDocument(
            document.uri,
            this.id
        )
    }

    abstract id: string;
    abstract doComplete(document: TextDocument, position: Position): CompletionList | Promise<CompletionList>;
    abstract doHover(document: TextDocument, position: Position): Hover;
    abstract doResolve(item: CompletionItem): CompletionItem;
    abstract getReferences(document: TextDocument, position: Position): Location[];
    abstract getSignatureHelp(document: TextDocument, position: Position): SignatureHelp;
    getDocumentSymbols(doc: TextDocument): SymbolInformation[] {
        return [];
    }
    getDocumentHighlight(document: TextDocument, position: Position): DocumentHighlight[] {
        return [];
    }
    getSemanticTokens(document: TextDocument, range?: Range): ISemanticTokenData[] {
        return [];
    }
}