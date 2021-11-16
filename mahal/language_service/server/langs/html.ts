import { doComplete } from "vscode-emmet-helper";
import { CompletionList, LanguageService, TextDocument } from "vscode-html-languageservice";
import { Position } from "vscode-languageserver-textdocument";
import { MahalLang } from "../abstracts";
import { DocManager } from "../managers";

export class HtmlLang extends MahalLang {
    constructor(
        private langService: LanguageService,
        private docManager: DocManager
    ) {
        super();
    }

    get id() {
        return 'html'
    }

    private getDoc_(document: TextDocument) {
        return this.docManager.getEmbeddedDocument(
            document,
            this.id
        )
    }

    doComplete(document: TextDocument, position: Position) {
        const doc = this.getDoc_(document);

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
            return CompletionList.create([
                ...emmetItems,
                ...htmlList.items
            ],
                emmetItems.length > 0
            )
        })
    }
}