import { doComplete } from "vscode-emmet-helper";
import { ColorPresentation, CompletionItem, CompletionList, DocumentHighlight, FormattingOptions, InsertReplaceEdit, LanguageService, Range, SymbolInformation, TextDocument, TextEdit } from "vscode-html-languageservice";
import { Position } from "vscode-languageserver-textdocument";
import { MahalLang } from "../abstracts";
import { ISemanticTokenData } from "../interfaces";
import { DocManager } from "../managers";
import { MahalDoc } from "../models";
import { JsLang } from "../langs/js";

export class HtmlLang extends MahalLang {

    readonly id = 'html';

    constructor(
        private langService: LanguageService,
        docManager: DocManager
    ) {
        super(docManager);
    }


    doComplete(document: MahalDoc, position: Position, jsService: JsLang) {
        const { doc, pos } = this.getActualPosition(document, position);

        return this.langService.doComplete2(
            doc,
            pos,
            this.langService.parseHTMLDocument(doc),
            {
                resolveReference(ref, base) {
                    return null;
                }
            }
        ).then(htmlList => {
            const emmetResults = doComplete(
                doc, pos, this.id,
                {

                }
            );
            const emmetItems = emmetResults ? emmetResults.items : [];
            let results = [
                ...emmetItems,
                ...htmlList.items
            ];
            results.forEach(item => {
                if (!item) return;
                const range = (item.textEdit as TextEdit).range
                range.start.line = position.line;
                range.end.line = position.line;
            })
            results = [
                ...results,
                ...jsService.getDocumentSymbolsForHTML(document).map(item => {
                    return {
                        label: item.name,
                        kind: item.kind
                    } as CompletionItem
                })
            ]
            // console.log("emmetItems", emmetItems.length);
            return CompletionList.create(
                results,
                results.length <= 0
            )
        })
    }

    doHover(document: MahalDoc, position: Position) {
        const doc = document.textDoc;
        return this.langService.doHover(
            doc,
            position,
            this.langService.parseHTMLDocument(doc)
        )
    }

    getDocumentHighlight(document: MahalDoc, position: Position): DocumentHighlight[] {
        const doc = document.textDoc;
        return this.langService.findDocumentHighlights(
            doc,
            position,
            this.langService.parseHTMLDocument(doc)
        )
    }

    getDocLinks(document: MahalDoc) {
        return this.langService.findDocumentLinks(
            document.textDoc,
            {
                resolveReference: () => {
                    return null;
                }
            }
        )
    }

    getDocumentSymbols(document: MahalDoc): SymbolInformation[] {
        const { doc } = this.getDoc(document);
        return this.langService.findDocumentSymbols(
            doc,
            this.langService.parseHTMLDocument(doc)
        )
    }

    format(doc: MahalDoc, formatParams: FormattingOptions) {
        // const uri = doc.uri;
        const editorConfig = this.docManager.editorConfig;
        const format = this.docManager.editorConfig.script.format;
        if (!format.enable) {
            return [];
        }

        const region = this.getRegion(doc);
        if (!region) {
            return [];
        }
        const range = {
            start: doc.positionAt(region.start + 1),
            end: doc.positionAt(region.end - 1)
        }

        // const fileFsPath = this.getFileName(uri);
        // const region = this.getRegion(doc);
        return this.langService.format(
            doc.textDoc,
            range,
            {
                tabSize: editorConfig.tabSize,
                preserveNewLines: true,
                indentEmptyLines: false,
            }
        )
    }
}