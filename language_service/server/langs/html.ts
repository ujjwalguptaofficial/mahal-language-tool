import { doComplete } from "vscode-emmet-helper";
import { ColorPresentation, CompletionItem, CompletionList, Diagnostic, DocumentHighlight, FormattingOptions, InsertReplaceEdit, LanguageService, Range, SymbolInformation, TextDocument, TextEdit } from "vscode-html-languageservice";
import { Position } from "vscode-languageserver-textdocument";
import { MahalLang } from "../abstracts";
import { EmbeddedRegion, ISemanticTokenData } from "../interfaces";
import { DocManager } from "../managers";
import { MahalDoc } from "../models";
import { JsLang } from "../langs/js";
import { parseview } from "mahal-html-compiler";
import { DiagnosticSeverity } from "vscode-languageserver/node";

interface IHTMLParseErrorLocation {
    offset: number,
    line: number,
    column: number
}

export class HtmlLang extends MahalLang {

    readonly id = 'html';

    constructor(
        private langService: LanguageService,
        docManager: DocManager
    ) {
        super(docManager);
    }


    doComplete(document: MahalDoc, position: Position, region: EmbeddedRegion, jsService: JsLang) {
        const { doc, pos } = this.getActualPosition(document, position, region);

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
                this.setRelativeRange(
                    range, position
                )
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

    doHover(document: MahalDoc, position: Position, region: EmbeddedRegion) {
        const { doc, pos } = this.getActualPosition(document, position, region);
        const results = this.langService.doHover(
            doc,
            pos,
            this.langService.parseHTMLDocument(doc)
        )
        if (!results) {
            return;
        }
        this.setRelativeRange(
            results.range, position
        );
        return results;
    }

    getDocumentHighlight(document: MahalDoc, position: Position, region: EmbeddedRegion): DocumentHighlight[] {
        const { doc, pos } = this.getActualPosition(document, position, region);
        const results = this.langService.findDocumentHighlights(
            doc,
            pos,
            this.langService.parseHTMLDocument(doc)
        );
        results.forEach(item => {
            this.setRelativeRange(
                item.range, position
            );
        })
        return results;
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
        const region = this.getRegion(document);
        if (!region) {
            return [];
        }
        const doc = this.getRegionDoc(document, region);

        const results = this.langService.findDocumentSymbols(
            doc,
            this.langService.parseHTMLDocument(doc)
        );
        const startPos = document.positionAt(region.start);
        results.forEach(item => {
            const range = item.location.range;
            range.start.line += startPos.line;
            range.end.line += startPos.line;
        });
        return results;
    }


    format(document: MahalDoc, formatParams: FormattingOptions) {
        // const uri = doc.uri;
        const editorConfig = this.docManager.editorConfig;
        const formatConfig = this.docManager.editorConfig.script.format;
        if (!formatConfig.enable) {
            return [];
        }
        const region = this.getRegion(document);
        if (!region) {
            return [];
        }
        const doc = this.getRegionDoc(document, region);


        // console.log('doc', `"${doc.getText()}"`);

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

        // console.log('range', range);

        const results = this.langService.format(
            doc,
            range,
            {
                tabSize: editorConfig.tabSize,
                preserveNewLines: true,
                indentEmptyLines: true,
            }
        );
        const startPos = document.positionAt(region.start);
        // const endPos = document.positionAt(region.end);

        // console.log('startPOS', startPos, 'endPOS', endPos);

        results.forEach(item => {
            // console.log("item", item);
            item.range.start.line += startPos.line;
            item.range.end.line += startPos.line;
            // item.newText = item.newText + "\n";
            // console.log("item range", item);
        })
        // console.log('results', results.length, results[0]);
        return results;
    }

    validate(document: MahalDoc, cancellationToken?: any) {
        const region = this.getRegion(document);
        const doc = this.getRegionDoc(document, region);
        const text = doc.getText();
        const startPos = document.positionAt(region.start);

        // console.log("html validation", text);
        try {
            parseview(text);
        } catch (error) {
            const location = error.location as {
                start: IHTMLParseErrorLocation,
                end: IHTMLParseErrorLocation
            };
            // console.error("error", error);
            const line = startPos.line - 1;
            return [Diagnostic.create({
                start: {
                    line: location.start.line + line,
                    character: location.start.column + startPos.character
                },
                end: {
                    line: location.end.line + line,
                    character: location.end.column + startPos.character
                }
            }, error.message, DiagnosticSeverity.Error)];
        }
        return [];
    }
}