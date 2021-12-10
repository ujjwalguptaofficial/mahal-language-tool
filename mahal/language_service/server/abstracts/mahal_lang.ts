import { CompletionItem, Location, Range, CompletionList, Hover, DocumentHighlight } from "vscode-languageserver-protocol/node";
import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { Definition, SignatureHelp, SymbolInformation } from "vscode-languageserver/node";
import { ISemanticTokenData } from "../interfaces";
import { DocManager } from "../managers";
import { MahalDoc } from "../models";
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

    protected getRegion(document: MahalDoc) {
        const languageRegions = document.regions.filter(item => item.languageId === this.id);
        return languageRegions[0]
    }

    abstract id: string;
    abstract doComplete(document: MahalDoc, position: Position): CompletionList | Promise<CompletionList>;
    abstract doHover(document: MahalDoc, position: Position): Hover;
    abstract doResolve(item: CompletionItem): CompletionItem;
    getReferences(document: MahalDoc, position: Position): Location[] {
        return [];
    }
    getDefinition(document: MahalDoc, position: Position): Definition {
        return [];
    }
    abstract getSignatureHelp(document: MahalDoc, position: Position): SignatureHelp;
    getDocumentSymbols(doc: MahalDoc): SymbolInformation[] {
        return [];
    }
    getDocumentHighlight(document: MahalDoc, position: Position): DocumentHighlight[] {
        return [];
    }
    getSemanticTokens(document: MahalDoc, range?: Range): ISemanticTokenData[] {
        return [];
    }
}