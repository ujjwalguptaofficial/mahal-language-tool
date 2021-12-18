import { getLanguageService } from 'vscode-html-languageservice';
import {
    CompletionItem, Connection, DefinitionParams,
    DocumentFormattingParams,
    DocumentHighlightParams, DocumentSymbolParams, InitializeParams,
    Position, ReferenceParams, SemanticTokensBuilder, SemanticTokensParams,
    SignatureHelpParams, SymbolInformation, TextDocumentIdentifier, TextEdit,
} from 'vscode-languageserver/node';
import { MahalLang } from './abstracts';
import { ISemanticTokenData } from './interfaces';
import { CssLang, HtmlLang, JsLang } from './langs';
import { DocManager } from './managers';
import { MahalDoc } from './models';
import { TypeScriptService, RefTokensService } from './services';
import { getCSSLanguageService } from "vscode-css-languageservice";

export class LangManager {

    langs: { [id: string]: MahalLang } = {

    };

    docManager: DocManager;

    listen(connection: Connection, params: InitializeParams) {
        const htmlService = getLanguageService();



        const docManager = this.docManager = new DocManager(
            htmlService
        );

        docManager.setEditorConfig(params.initializationOptions.clientConfig);

        const jsService = new TypeScriptService(params,
            docManager
        ).getLangService();


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

        connection.onDidChangeWatchedFiles(
            docManager.onExternalDocChange.bind(docManager)
        );


        this.langs['html'] = new HtmlLang(
            htmlService, this.docManager
        );
        this.langs['css'] = new CssLang(
            getCSSLanguageService(), this.docManager
        );
        if (jsService) {
            const refTokensService = new RefTokensService(connection)
            this.langs['javascript'] = new JsLang(
                jsService, this.docManager, refTokensService
            );
        }

        // const config =
        //     console.log("config", config);
    }

    getByURI(uri: string) {
        const document = this.docManager.getByURI(
            uri
        );
        if (!document) {
            throw new Error('The document should be opened for completion, file: ' + uri);
        }
        return document;
    }

    getActiveLang(uri: string, position: Position) {
        const document = this.getByURI(
            uri
        );

        const languageId = this.docManager.getLanguageAtPosition(
            document,
            position
        );

        // console.log("languageId", languageId);
        const activeLang = this.langs[languageId];
        return { activeLang, document };
    }

    doComplete(docIdentifier: TextDocumentIdentifier, position: Position) {
        const { activeLang, document } = this.getActiveLang(
            docIdentifier.uri, position
        );
        if (activeLang) {
            return activeLang.doComplete(document, position, this.langs['javascript'] as any);
        }
    }

    doHover(docIdentifier: TextDocumentIdentifier, position: Position) {
        const { activeLang, document } = this.getActiveLang(
            docIdentifier.uri, position
        );

        if (activeLang) {
            return activeLang.doHover(document, position);
        }
    }

    doCompletionResolve(item: CompletionItem) {
        const { activeLang } = this.getActiveLang(
            item.data.uri, item.data.position
        );

        if (activeLang) {
            return activeLang.doResolve(item);
        }
    }

    getReferences(params: ReferenceParams) {
        const { activeLang, document } = this.getActiveLang(
            params.textDocument.uri, params.position
        );

        if (activeLang) {
            return activeLang.getReferences(
                document, params.position
            );
        }
    }
    getSignatureHelp(params: SignatureHelpParams) {
        const { activeLang, document } = this.getActiveLang(
            params.textDocument.uri, params.position
        );

        if (activeLang) {
            return activeLang.getSignatureHelp(
                document, params.position
            );
        }
    }

    *eachLang(uri: string) {
        const document = this.getByURI(uri);
        yield document;
        for (const languageId in this.langs) {
            const lang = this.langs[languageId];
            yield lang;
        }

    }

    getDocumentSymbols(params: DocumentSymbolParams) {
        const uri = params.textDocument.uri;
        const langs = this.eachLang(uri);
        const document = langs.next().value as MahalDoc;
        var lang = langs.next()
        let symbols: SymbolInformation[] = [];
        while (!lang.done) {
            symbols = symbols.concat(
                (lang.value as MahalLang).
                    getDocumentSymbols(document)
            )
            lang = langs.next();
        }
        return symbols;

    }
    onSemanticTokens(params: SemanticTokensParams) {
        const uri = params.textDocument.uri;
        let data: ISemanticTokenData[] = [];
        const langs = this.eachLang(uri);
        const document = langs.next().value as MahalDoc;
        var lang = langs.next()
        while (!lang.done) {
            data = data.concat(
                (lang.value as MahalLang).
                    getSemanticTokens(document)
            )
            lang = langs.next();
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
        const { activeLang, document } = this.getActiveLang(
            params.textDocument.uri, params.position
        );
        if (activeLang) {
            return activeLang.getDocumentHighlight(
                document, params.position
            );
        }
    }

    getDefinition(params: DefinitionParams) {
        const { activeLang, document } = this.getActiveLang(
            params.textDocument.uri, params.position
        );
        if (activeLang) {
            return activeLang.getDefinition(
                document, params.position
            );
        }

    }

    format(params: DocumentFormattingParams) {
        const uri = params.textDocument.uri;
        const langs = this.eachLang(uri);
        const document = langs.next().value as MahalDoc;
        var lang = langs.next()
        let symbols: TextEdit[] = [];
        while (!lang.done) {
            symbols = symbols.concat(
                (lang.value as MahalLang).
                    format(
                        document,
                        params.options
                    )
            )
            lang = langs.next();
        }
        return symbols;
    }


}