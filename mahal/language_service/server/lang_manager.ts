import { getLanguageService } from 'vscode-html-languageservice';
import { CompletionItem, Connection, DocumentHighlightParams, DocumentSymbolParams, InitializeParams, Position, ReferenceParams, SemanticTokensBuilder, SemanticTokensParams, SignatureHelpParams, SymbolInformation, TextDocumentIdentifier } from 'vscode-languageserver/node';
import { MahalLang } from './abstracts';
import { ISemanticTokenData } from './interfaces';
import { HtmlLang, JsLang } from './langs';
import { DocManager } from './managers';
import { getTypescriptService, RefTokensService } from './services';

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
            const refTokensService = new RefTokensService(connection)
            this.langs['javascript'] = new JsLang(
                jsService, this.docManager, refTokensService
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

        // console.log("languageId", languageId);
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

    getReferences(params: ReferenceParams) {
        const uri = params.textDocument.uri;
        const document = this.docManager.getByURI(
            uri
        );
        if (!document) {
            throw new Error('The document should be opened for completion, file: ' + uri);
        }

        const languageId = this.docManager.getLanguageAtPosition(
            document.textDoc,
            params.position
        );

        const activeLang = this.langs[languageId];
        if (activeLang) {
            return activeLang.getReferences(
                document.textDoc, params.position
            );
        }
    }
    getSignatureHelp(params: SignatureHelpParams) {
        const uri = params.textDocument.uri;
        const document = this.docManager.getByURI(
            uri
        );
        if (!document) {
            throw new Error('The document should be opened for completion, file: ' + uri);
        }

        const languageId = this.docManager.getLanguageAtPosition(
            document.textDoc,
            params.position
        );

        const activeLang = this.langs[languageId];
        if (activeLang) {
            return activeLang.getSignatureHelp(
                document.textDoc, params.position
            );
        }
    }
    getDocumentSymbols(params: DocumentSymbolParams) {
        const uri = params.textDocument.uri;
        const document = this.docManager.getByURI(
            uri
        );
        if (!document) {
            throw new Error('The document should be opened for completion, file: ' + uri);
        }
        let symbols: SymbolInformation[] = [];
        for (const languageId in this.langs) {
            const lang = this.langs[languageId];
            symbols = symbols.concat(
                lang.getDocumentSymbols(document.textDoc)
            )
        }

        return symbols;

    }
    onSemanticTokens(params: SemanticTokensParams) {
        const uri = params.textDocument.uri;
        const document = this.docManager.getByURI(
            uri
        );
        if (!document) {
            throw new Error('The document should be opened for completion, file: ' + uri);
        }
        let data: ISemanticTokenData[] = [];
        for (const languageId in this.langs) {
            const lang = this.langs[languageId];
            data = data.concat(
                lang.getSemanticTokens(document.textDoc)
            )
        }
        const sorted = data.sort((a, b) => {
            return a.line - b.line || a.character - b.character;
        });
        const builder = new SemanticTokensBuilder();
        sorted.forEach(token =>
            builder.push(token.line, token.character, token.length, token.classificationType, token.modifierSet)
        );
        return builder.build();

    }
    getDocumentHighlight(params: DocumentHighlightParams) {
        const uri = params.textDocument.uri;
        const document = this.docManager.getByURI(
            uri
        );
        if (!document) {
            throw new Error('The document should be opened for completion, file: ' + uri);
        }

        const languageId = this.docManager.getLanguageAtPosition(
            document.textDoc,
            params.position
        );

        const activeLang = this.langs[languageId];
        if (activeLang) {
            return activeLang.getDocumentHighlight(
                document.textDoc, params.position
            );
        }
    }



}