import { CompletionList, FormattingOptions, Hover, TextEdit } from "vscode-languageserver/node";
import { Position } from "vscode-languageserver-textdocument";
import { MahalLang } from "../abstracts";
import { DocManager } from "../managers";
import { MahalDoc } from "../models";
import { JsLang } from "./js";
import { format, } from "prettier";
import * as emmet from 'vscode-emmet-helper';


export class YmlLang extends MahalLang {
    constructor(
        docManager: DocManager,
    ) {
        super(docManager);
    }

    id: string = "yml";


    doComplete(document: MahalDoc, position: Position, jsLang: JsLang): CompletionList | Promise<CompletionList> {
        const { doc, pos } = this.getActualPosition(document, position);
        const result = emmet.doComplete(doc, pos, 'yaml', {

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
        const region = this.getRegion(document);
        if (!region) {
            return [];
        }
        const doc = this.getDoc(document, region);

        const formattedString = format(doc.getText(), {
            parser: 'yaml',
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
}