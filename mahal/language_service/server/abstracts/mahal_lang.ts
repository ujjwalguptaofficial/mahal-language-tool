import { CompletionItem, Location, Range, CompletionList, Hover, DocumentHighlight } from "vscode-languageserver-protocol/node";
import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { Definition, SignatureHelp, SymbolInformation } from "vscode-languageserver/node";
import { ISemanticTokenData } from "../interfaces";
import { DocManager } from "../managers";
import { getFilePathFromURL } from "../utils";

export abstract class MahalLang {

    constructor(
        protected docManager: DocManager
    ) {

    }
    
    protected getFileName(uri) {
        return getFilePathFromURL(uri);
        // + ".ts";
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
    getReferences(document: TextDocument, position: Position): Location[] {
        return [];
    }
    getDefinition(document: TextDocument, position: Position): Definition {
        return [];
    }
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