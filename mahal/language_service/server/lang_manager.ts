import { getLanguageService } from 'vscode-html-languageservice';
import {
    ColorInformation,
    ColorPresentation,
    ColorPresentationParams,
    CompletionItem, Connection, DefinitionParams,
    Diagnostic,
    DidChangeTextDocumentParams,
    DidOpenTextDocumentParams,
    DocumentColorParams,
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
import { TypeScriptService } from './services';
import { getCSSLanguageService } from "vscode-css-languageservice";

export class LangManager {

    langs: { [id: string]: MahalLang } = {

    };

    docManager: DocManager;

    constructor(public connection: Connection) {
        this.initializeLangs();
    }

    initializeLangs() {
        const htmlService = getLanguageService();
        const docManager = this.docManager = new DocManager(
            htmlService
        );

        this.langs['html'] = new HtmlLang(
            htmlService, this.docManager
        );
        this.langs['css'] = new CssLang(
            getCSSLanguageService(), this.docManager
        );


    }

    initJsLang(params: InitializeParams) {
        const jsService = new TypeScriptService(params,
            this.docManager
        ).getLangService();
        this.langs['javascript'] = new JsLang(
            jsService, this.docManager
        );
    }

    listen(params: InitializeParams) {
        this.initJsLang(params)
        const connection = this.connection;

        const docManager = this.docManager;

        docManager.setEditorConfig(params.initializationOptions.clientConfig);

        connection.onDidOpenTextDocument((params: DidOpenTextDocumentParams) => {
            docManager.onOpenTextDocument(params)
            this.onFileChange(params.textDocument.uri);
        });
        connection.onDidChangeTextDocument((params: DidChangeTextDocumentParams) => {
            docManager.didChangeTextDocument(params);
            this.onFileChange(params.textDocument.uri);
        });

        connection.onDidSaveTextDocument(
            docManager.didSaveTextDocument.bind(docManager)
        );
        connection.onDidCloseTextDocument(
            docManager.didCloseTextDocument.bind(docManager)
        );

        connection.onDidChangeWatchedFiles(
            docManager.onExternalDocChange.bind(docManager)
        );

        connection.onCompletion((params) => {
            return this.doComplete(
                params.textDocument, params.position
            );
        });

        connection.onHover((params) => {
            return this.doHover(params.textDocument, params.position)
        });


        connection.onCompletionResolve((params) => {
            return this.doCompletionResolve(params);
        });

        connection.onReferences((params) => {
            return this.getReferences(params);
        })

        connection.onSignatureHelp((params) => {
            return this.getSignatureHelp(params);
        })
        connection.onDocumentSymbol((params) => {
            return this.getDocumentSymbols(params);
        })
        connection.onDocumentHighlight((params) => {
            return this.getDocumentHighlight(params);
        })

        connection.languages.semanticTokens.on((params) => {
            return this.onSemanticTokens(params);
        })
        connection.languages.semanticTokens.onRange((params) => {
            return this.onSemanticTokens(params);
        })
        connection.onDefinition((params) => {
            return this.getDefinition(params);
        })

        connection.onDocumentFormatting(params => {
            return this.format(params);
        })

        connection.onDocumentColor(params => {
            return this.getColors(params);
        })
        connection.onColorPresentation(params => {
            return this.getColorPresentation(params);
        })
    }

    fileChangeTimer: NodeJS.Timeout;

    onFileChange(uri: string) {
        if (this.fileChangeTimer) {
            clearTimeout(this.fileChangeTimer);
        }
        this.fileChangeTimer = setTimeout(() => {
            this.validate(uri);
        }, 200);
    }

    validate(uri: string) {
        const langs = this.eachLang(uri);
        const document = langs.next().value as MahalDoc;
        var lang = langs.next()
        let diagnostics: Diagnostic[] = [];
        while (!lang.done) {
            diagnostics = diagnostics.concat(
                (lang.value as MahalLang).
                    validate(document)
            )
            lang = langs.next();
        }

        this.connection.sendDiagnostics({
            diagnostics: diagnostics,
            uri: document.uri
        })
        return diagnostics;
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
        // first return document
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

    getColors(params: DocumentColorParams) {
        const uri = params.textDocument.uri;
        const langs = this.eachLang(uri);
        const document = langs.next().value as MahalDoc;
        var lang = langs.next()
        let colors: ColorInformation[] = [];
        while (!lang.done) {
            colors = colors.concat(
                (lang.value as MahalLang).
                    getColors(document)
            )
            lang = langs.next();
        }
        return colors;
    }

    getColorPresentation(params: ColorPresentationParams) {
        const uri = params.textDocument.uri;
        const langs = this.eachLang(uri);
        const document = langs.next().value as MahalDoc;
        var lang = langs.next()
        let colors: ColorPresentation[] = [];
        while (!lang.done) {
            colors = colors.concat(
                (lang.value as MahalLang).
                    getColorPresentation(document, params.color, params.range)
            )
            lang = langs.next();
        }
        return colors;
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