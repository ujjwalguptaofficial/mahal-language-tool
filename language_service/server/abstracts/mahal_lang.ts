import { CompletionItem, Location, Range, CompletionList, Hover, DocumentHighlight, FormattingOptions, TextEdit, ColorPresentation, ColorInformation, Color, Diagnostic, CodeAction, Command } from "vscode-languageserver-protocol/node";
import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { CodeActionContext, Definition, SignatureHelp, SymbolInformation } from "vscode-languageserver/node";
import { EmbeddedRegion, ISemanticTokenData } from "../interfaces";
import { JsLang } from "../langs";
import { DocManager } from "../managers";
import { MahalDoc } from "../models";
import { LanguageId } from "../types";
import { getFilePathFromURL } from "../utils";

export abstract class MahalLang {

    constructor(
        public docManager: DocManager
    ) {

    }

    validate(document: MahalDoc, cancellationToken?: any): Diagnostic[] {
        return []
    }

    getCodeActionResolve(doc: MahalDoc, action: CodeAction): CodeAction {
        return null;
    }

    protected setRelativeRange(range: Range, position: Position) {
        range.start.line = position.line;
        range.end.line = position.line;
    }


    protected getFileName(uri) {
        return getFilePathFromURL(uri);
        // + ".ts";
    }

    protected getActualPosition(document: MahalDoc, position: Position, region: EmbeddedRegion) {
        const doc = this.getRegionDoc(document, region);
        const pos = doc.positionAt(document.offsetAt(position) - region.start);
        return {
            doc,
            pos: pos
        }
    }


    protected getRegionDoc(document: MahalDoc, region: EmbeddedRegion) {
        return this.docManager.getEmbeddedDocument(
            document.uri,
            region
        )
    }

    protected getRegions(document: MahalDoc, langId?: LanguageId) {
        langId = langId || this.id as any;
        return document.regions.filter(item => item.languageId === langId);
    }

    protected getRegion(document: MahalDoc) {
        const languageRegions = this.getRegions(document);
        return languageRegions[0]
    }

    abstract id: LanguageId | string;
    abstract doComplete(document: MahalDoc, position: Position, region: EmbeddedRegion, jsLang: JsLang): CompletionList | Promise<CompletionList>;
    doHover(document: MahalDoc, position: Position, region: EmbeddedRegion): Hover {
        return null;
    }
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
    getColors(doc: MahalDoc): ColorInformation[] {
        return [];
    }
    getColorPresentation(document: MahalDoc, color: Color, range: Range): ColorPresentation[] {
        return [];
    }
    getDocumentHighlight(document: MahalDoc, position: Position, region: EmbeddedRegion): DocumentHighlight[] {
        return [];
    }
    getSemanticTokens(document: MahalDoc, range?: Range): ISemanticTokenData[] {
        return [];
    }
    format(doc: MahalDoc, formatParams: FormattingOptions): TextEdit[] {
        return [];
    }

    getCodeAction(document: MahalDoc, range: Range, context: CodeActionContext): (CodeAction | Command)[] {
        return [];
    }
}