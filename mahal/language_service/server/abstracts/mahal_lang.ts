import { CompletionItem, Location, Range, CompletionList, Hover, DocumentHighlight, FormattingOptions, TextEdit } from "vscode-languageserver-protocol/node";
import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { Definition, SignatureHelp, SymbolInformation } from "vscode-languageserver/node";
import { ISemanticTokenData } from "../interfaces";
import { JsLang } from "../langs";
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
    abstract doComplete(document: MahalDoc, position: Position, jsLang: JsLang): CompletionList | Promise<CompletionList>;
    abstract doHover(document: MahalDoc, position: Position): Hover;
    doResolve(item: CompletionItem): CompletionItem {
        return null;
    }
    getReferences(document: MahalDoc, position: Position): Location[] {
        return [];
    }
    getDefinition(document: MahalDoc, position: Position): Definition {
        return [];
    }
    getSignatureHelp(document: MahalDoc, position: Position): SignatureHelp {
        return null;
    }
    getDocumentSymbols(doc: MahalDoc): SymbolInformation[] {
        return [];
    }
    getDocumentHighlight(document: MahalDoc, position: Position): DocumentHighlight[] {
        return [];
    }
    getSemanticTokens(document: MahalDoc, range?: Range): ISemanticTokenData[] {
        return [];
    }
    format(doc: MahalDoc, formatParams: FormattingOptions): TextEdit[] {
        return [];
    }
}