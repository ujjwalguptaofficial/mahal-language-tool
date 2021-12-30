import { CompletionItem, Location, Range, CompletionList, Hover, DocumentHighlight, FormattingOptions, TextEdit, ColorPresentation, ColorInformation, Color, Diagnostic, CodeAction, Command } from "vscode-languageserver-protocol/node";
import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { CodeActionContext, Definition, SignatureHelp, SymbolInformation } from "vscode-languageserver/node";
import { ISemanticTokenData } from "../interfaces";
import { JsLang } from "../langs";
import { DocManager } from "../managers";
import { MahalDoc } from "../models";
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

    protected getActualPosition(document: MahalDoc, position: Position) {
        const { doc } = this.getDoc(document);
        const region = this.getRegion(document);
        const pos = doc.positionAt(document.offsetAt(position) - region.start);
        return {
            doc,
            pos: pos
        }
    }


    protected getDoc(document: MahalDoc) {
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
    getColors(doc: MahalDoc): ColorInformation[] {
        return [];
    }
    getColorPresentation(document: MahalDoc, color: Color, range: Range): ColorPresentation[] {
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

    getCodeAction(document: MahalDoc, range: Range, context: CodeActionContext): (CodeAction | Command)[] {
        return [];
    }
}