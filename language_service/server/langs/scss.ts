import { CompletionList, FormattingOptions, Hover, TextEdit } from "vscode-languageserver/node";
import { Position } from "vscode-languageserver-textdocument";
import { MahalLang } from "../abstracts";
import { DocManager } from "../managers";
import { MahalDoc } from "../models";
import { JsLang } from "./js";
import { format } from "prettier";
import * as emmet from 'vscode-emmet-helper';
import { EmbeddedRegion } from "../interfaces";


export class ScssLang extends MahalLang {
    constructor(
        docManager: DocManager,
    ) {
        super(docManager);
    }

    id: string = "scss";


    doComplete(document: MahalDoc, position: Position, region: EmbeddedRegion): CompletionList | Promise<CompletionList> {
        const { doc, pos } = this.getActualPosition(document, position, region);
        const result = emmet.doComplete(doc, pos, 'scss', {

        });
        if (!result) {
            return null;
        }
        result.items.forEach(item => {
            const range = (item.textEdit as TextEdit).range
            range.start.line = position.line;
            range.end.line = position.line;
        });
        return result;
    }

    format(document: MahalDoc, formatParams: FormattingOptions) {
        const editorConfig = this.docManager.editorConfig;
        const formatConfig = this.docManager.editorConfig.script.format;
        if (!formatConfig.enable) {
            return [];
        }
        const regions = this.getRegions(document);
        const result: TextEdit[] = [];
        regions.forEach(region => {
            const doc = this.getRegionDoc(document, region);
            const formattedString = format(doc.getText(), {
                parser: "scss",
                tabWidth: editorConfig.tabSize,
            });
            const range = {
                start: document.positionAt(region.start + 1),
                // end: document.positionAt(region.end - 1)
                end: document.positionAt(region.end)
            }
            result.push(
                TextEdit.replace(range, formattedString)
            );
        });
        return result;
    }
}