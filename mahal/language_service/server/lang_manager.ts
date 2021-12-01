import { getLanguageService } from 'vscode-html-languageservice';
import { CompletionItem, Connection, InitializeParams, Position, TextDocumentIdentifier } from 'vscode-languageserver/node';
import { MahalLang } from './abstracts';
import { HtmlLang, JsLang } from './langs';
import { DocManager } from './managers';
import { getTypescriptService } from './services';

export class LangManager {

    langs: { [id: string]: MahalLang } = {

    };

    docManager: DocManager;

    listen(connection: Connection, params: InitializeParams) {
        const htmlService = getLanguageService();



        const docManager = this.docManager = new DocManager(
            htmlService
        );

        const jsService = getTypescriptService(params,
            docManager
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
        if (jsService) {
            this.langs['javascript'] = new JsLang(
                jsService, this.docManager
            );
        }
    }

    doComplete(docIdentifier: TextDocumentIdentifier, position: Position) {
        const uri = docIdentifier.uri;
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
        if (activeLang) {
            return activeLang.doComplete(document.textDoc, position);
        }
    }

    doHover(docIdentifier: TextDocumentIdentifier, position: Position) {
        const uri = docIdentifier.uri;
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

        const activeLang = this.langs[languageId];
        if (activeLang) {
            return activeLang.doHover(document.textDoc, position);
        }
    }

    doCompletionResolve(item: CompletionItem) {
        const uri = item.data.uri;
        const document = this.docManager.getByURI(
            uri
        );
        if (!document) {
            throw new Error('The document should be opened for completion, file: ' + uri);
        }

        const languageId = this.docManager.getLanguageAtPosition(
            document.textDoc,
            item.data.position
        );

        const activeLang = this.langs[languageId];
        if (activeLang) {
            return activeLang.doResolve(item);
        }
    }


}