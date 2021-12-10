import { doComplete } from "vscode-emmet-helper";
import { CompletionList, LanguageService, TextDocument } from "vscode-html-languageservice";
import { Position } from "vscode-languageserver-textdocument";
import { MahalLang } from "../abstracts";
import { DocManager } from "../managers";
import { MahalDoc } from "../models";

export class HtmlLang extends MahalLang {

    readonly id = 'html';

    constructor(
        private langService: LanguageService,
        docManager: DocManager
    ) {
        super(docManager);
    }

    doComplete(document: MahalDoc, position: Position) {
        const doc = document.textDoc;
        return this.langService.doComplete2(
            doc,
            position,
            this.langService.parseHTMLDocument(doc),
            {
                resolveReference(ref, base) {
                    return null;
                }
            }
        ).then(htmlList => {
            const emmetResults = doComplete(
                doc, position, this.id,
                {

                }
            );
            const emmetItems = emmetResults ? emmetResults.items : [];
            // console.log("emmetItems", emmetItems.length);
            return CompletionList.create([
                ...emmetItems,
                ...htmlList.items
            ],
                emmetItems.length > 0
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

    doResolve() {
        return null
    }
    getSignatureHelp() {
        return null
    }
}