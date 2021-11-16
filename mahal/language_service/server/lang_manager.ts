import { getLanguageService } from 'vscode-html-languageservice';
import { Connection, Position, TextDocumentIdentifier } from 'vscode-languageserver/node';
import { MahalLang } from './abstracts';
import { HtmlLang } from './langs';
import { DocManager } from './managers';

export class LangManager {

    langs: { [id: string]: MahalLang } = {

    };

    docManager: DocManager;

    listen(connection: Connection) {
        const htmlService = getLanguageService();

        const docManager = this.docManager = new DocManager(
            htmlService
        );

        connection.onDidOpenTextDocument(
            docManager.onOpenTextDocument.bind(docManager)
        );
        connection.onDidChangeTextDocument(
            docManager.didChangeTextDocument.bind(docManager)
        );

        connection.onDidSaveTextDocument(
            docManager.didSaveTextDocument.bind(docManager)
        );
        connection.onDidCloseTextDocument(
            docManager.didCloseTextDocument.bind(docManager)
        );


        this.langs['html'] = new HtmlLang(
            htmlService, this.docManager
        );
    }

    doComplete(docIdentifier: TextDocumentIdentifier, position: Position) {
        const uri = docIdentifier.uri;
        console.log("doComplete", uri);
        console.log("keys",
            Array.from(this.docManager.docs.keys as any)
        )
        const document = this.docManager.getByURI(
            uri
        );
        if (!document) {
            throw new Error('The document should be opened for completion, file: ' + uri);
        }

        const languageId = this.docManager.getLanguageAtPosition(
            document.textDoc,
            position
        );

        console.log("languageId", languageId);
        const activeLang = this.langs[languageId];

        return activeLang.doComplete(document.textDoc, position);

    }


}