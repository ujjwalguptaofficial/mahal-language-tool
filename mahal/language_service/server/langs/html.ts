import { doComplete } from "vscode-emmet-helper";
import { ColorPresentation, CompletionItem, CompletionList, DocumentHighlight, FormattingOptions, InsertReplaceEdit, LanguageService, Range, SymbolInformation, TextDocument, TextEdit } from "vscode-html-languageservice";
import { Position } from "vscode-languageserver-textdocument";
import { MahalLang } from "../abstracts";
import { ISemanticTokenData } from "../interfaces";
import { DocManager } from "../managers";
import { MahalDoc } from "../models";
import { JsLang } from "../langs/js";
import { format } from "prettier";

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

    format(document: MahalDoc, formatParams: FormattingOptions) {
        // const uri = doc.uri;
        const editorConfig = this.docManager.editorConfig;
        const formatConfig = this.docManager.editorConfig.script.format;
        if (!formatConfig.enable) {
            return [];
        }

        const { doc } = this.getDoc(document);
        const region = this.getRegion(document);
        if (!region) {
            return [];
        }

        // const formattedString = format(doc.getText(), {
        //     parser: "html",
        //     tabWidth: editorConfig.tabSize
        // });
        // const range = {
        //     start: document.positionAt(region.start + 1),
        //     end: document.positionAt(region.end)
        // }
        // return [
        //     TextEdit.replace(range, formattedString)
        // ];

        const range = {
            start: doc.positionAt(0),
            end: doc.positionAt(region.end - region.start)
        }

        const results = this.langService.format(
            doc,
            range,
            {
                tabSize: editorConfig.tabSize,
                preserveNewLines: true,
                indentEmptyLines: true,
            }
        );
        const startPos = document.positionAt(region.start + 1);
        const endPos = document.positionAt(region.end);

        // console.log('startPOS', startPos, 'endPOS', endPos);

        results.forEach(item => {
            // console.log("item", item);
            item.range.start.line = startPos.line;
            item.range.end.line = endPos.line;
            item.newText = item.newText + "\n";
            // console.log("item range", item);
        })
        // console.log('results', results.length, results[0]);
        return results;
    }
}