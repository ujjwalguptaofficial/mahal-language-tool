import { getLanguageService } from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position, TextDocumentIdentifier, TextDocuments } from 'vscode-languageserver/node';
import { MahalLang } from './abstracts';
import { getDocumentRegions, getLanguageModelCache } from './helpers';
import { ILangCache, IMahalDocCache } from './interfaces';
import { HtmlLang } from './langs';

export class LangManager {


    documents = new TextDocuments(TextDocument);

    langs: { [id: string]: MahalLang } = {

    };

    documentCache: ILangCache<IMahalDocCache>;

    constructor(connection) {

        // listend and update text doc
        this.documents.listen(connection);


        const htmlService = getLanguageService();
        this.documentCache = getLanguageModelCache<IMahalDocCache>(10, 60, document => {
            return getDocumentRegions(htmlService, document);
        });

        this.langs['html'] = new HtmlLang(
            htmlService, this.documentCache
        );
    }

    doComplete(docIdentifier: TextDocumentIdentifier, position: Position) {
        const uri = docIdentifier.uri;
        const document = this.documents.get(
            uri
        );
        if (!document) {
            throw new Error('The document should be opened for completion, file: ' + uri);
        }

        const languageId = this.documentCache.refreshAndGet(
            document
        ).getLanguageAtPosition(position);

        console.log("languageId", languageId);
        const activeLang = this.langs[languageId];

        return activeLang.doComplete(document, position);

    }


}