import { doComplete } from "vscode-emmet-helper";
import { CompletionList, LanguageService, TextDocument } from "vscode-html-languageservice";
import { Position } from "vscode-languageserver-textdocument";
import { MahalLang } from "../abstracts";
import { ILangCache, IMahalDocCache } from "../interfaces";

export class HtmlLang extends MahalLang {
    constructor(
        private langService: LanguageService,
        private documentCache: ILangCache<IMahalDocCache>
    ) {
        super();
    }

    get id() {
        return 'html'
    }

    private getDoc_(document: TextDocument) {
        return this.documentCache.refreshAndGet(document).getEmbeddedDocument(
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
                doc, position, 'html',
                {

                }
            ).items || [];
            return CompletionList.create([
                ...emmetResults,
                ...htmlList.items
            ],
                emmetResults.length > 0
            )
        })
    }
}