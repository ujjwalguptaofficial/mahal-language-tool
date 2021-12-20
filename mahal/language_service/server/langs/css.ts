import { Color, ColorPresentation, Range } from "vscode-languageserver/node";
import { LanguageService } from "vscode-css-languageservice";
import { CompletionList, FormattingOptions, Hover, TextEdit } from "vscode-languageserver/node";
import { Position } from "vscode-languageserver-textdocument";
import { MahalLang } from "../abstracts";
import { DocManager } from "../managers";
import { MahalDoc } from "../models";
import { JsLang } from "./js";
import { format } from "prettier";

export class CssLang extends MahalLang {
    constructor(private langService: LanguageService,
        docManager: DocManager,
    ) {
        super(docManager);
    }

    id: string = "css";

    setRelativeRange(range: Range, position: Position) {
        range.start.line = position.line;
        range.end.line = position.line;
    }

    doComplete(document: MahalDoc, position: Position, jsLang: JsLang): CompletionList | Promise<CompletionList> {
        const { doc, pos } = this.getActualPosition(document, position);
        const result = this.langService.doComplete(
            doc, pos,
            this.langService.parseStylesheet(doc)
        );
        result.items.forEach(item => {
            const range = (item.textEdit as TextEdit).range
            range.start.line = position.line;
            range.end.line = position.line;
        });
        return result;
    }

    doHover(document: MahalDoc, position: Position): Hover {
        const { doc, pos } = this.getActualPosition(document, position);

        const result = this.langService.doHover(
            doc, pos,
            this.langService.parseStylesheet(doc)
        );
        if (result) {
            this.setRelativeRange(result.range, position);
        }

        // result.range.start.line = position.line;
        // result.range.end.line = position.line;

        return result;
    }

    getDocumentSymbols(document: MahalDoc) {
        const { doc } = this.getDoc(document);
        return this.langService.findDocumentSymbols(
            doc,
            this.langService.parseStylesheet(doc)
        );
    }

    getDocumentHighlight(document: MahalDoc, position: Position) {
        const { doc, pos } = this.getActualPosition(document, position);
        const result = this.langService.findDocumentHighlights(
            doc,
            pos,
            this.langService.parseStylesheet(doc)
        );
        result.forEach(item => {
            this.setRelativeRange(item.range, position)
        });

        return result;
    }

    format(document: MahalDoc, formatParams: FormattingOptions) {
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
        const formattedString = format(doc.getText(), {
            parser: "css",
            tabWidth: editorConfig.tabSize,
        });
        const range = {
            start: document.positionAt(region.start + 1),
            // end: document.positionAt(region.end - 1)
            end: document.positionAt(region.end)
        }
        return [
            TextEdit.replace(range, formattedString)
        ];
    }

    getColors(document: MahalDoc) {
        const { doc } = this.getDoc(document);
        const region = this.getRegion(document);
        if (!region) {
            return [];
        }
        // console.log("getColors", doc.getText());
        const result = this.langService.findDocumentColors(
            doc,
            this.langService.parseStylesheet(doc)
        );
        // console.log("getColors", result.length);
        const pos = document.positionAt(region.start);
        result.forEach(item => {
            // console.log("item", item);
            item.range.start.line += pos.line;
            item.range.end.line += pos.line;
            // console.log("item range", item);
        })
        return result;
    }
    getColorPresentation(document: MahalDoc, color: Color, range: Range) {

        const { doc } = this.getDoc(document);
        const region = this.getRegion(document);
        // console.log("getColors", doc.getText());
        const result = this.langService.getColorPresentations(
            doc,
            this.langService.parseStylesheet(doc),
            color,
            range
        );
        // console.log("getColorPresentation", result.length);
        const pos = document.positionAt(region.start);
        result.forEach(item => {
            item.textEdit.range.start.line += pos.line;
            item.textEdit.range.end.line += pos.line;
        })
        return result;
    }
}