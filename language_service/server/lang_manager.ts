import { getLanguageService } from 'vscode-html-languageservice';
import {
    CodeAction,
    CodeActionParams,
    ColorInformation,
    ColorPresentation,
    ColorPresentationParams,
    CompletionItem, CompletionList, Connection, DefinitionParams,
    Diagnostic,
    DidChangeTextDocumentParams,
    DidOpenTextDocumentParams,
    DocumentColorParams,
    DocumentFormattingParams,
    DocumentHighlightParams, DocumentSymbolParams, InitializeParams,
    InsertTextFormat,
    Position, ReferenceParams, SemanticTokensBuilder, SemanticTokensParams,
    SignatureHelpParams, SymbolInformation, TextDocumentIdentifier, TextEdit,
} from 'vscode-languageserver/node';
import { MahalLang } from './abstracts';
import { CodeActionData, IAppConfig, ISemanticTokenData } from './interfaces';
import { CssLang, HtmlLang, JsLang, ScssLang, YmlLang } from './langs';
import { DocManager } from './managers';
import { MahalDoc } from './models';
import { TypeScriptService } from './services';
import { getCSSLanguageService } from "vscode-css-languageservice";
import path from 'path';
import { readFileSync } from 'fs';
import { basename } from "path";
import { DateTime } from "luxon";
import { logger } from './utils';
export class LangManager {

    langs: { [id: string]: MahalLang } = {

    };

    savedSnippets = {
        default: '',
        html: '',
        css: '',
        style: '',
        scss: ''
    }

    docManager: DocManager;

    constructor(public connection: Connection) {
        this.initializeLangs();
    }

    config: IAppConfig = {
        workspaceUri: '',
        hmlLanguageService: null as any,
        project: {
            language: 'js'
        }
    }

    initializeLangs() {
        const htmlService = getLanguageService();
        this.config.hmlLanguageService = htmlService;
        this.docManager = new DocManager(
            this.config
        );

        this.langs['html'] = new HtmlLang(
            htmlService, this.docManager
        );
        this.langs['css'] = new CssLang(
            getCSSLanguageService(), this.docManager
        );
        this.langs['scss'] = new ScssLang(
            this.docManager
        );
        this.langs['yml'] = new YmlLang(
            this.docManager
        );
    }

    initJsLang(params: InitializeParams) {
        const service = new TypeScriptService(params,
            this.docManager
        );
        this.langs['javascript'] = new JsLang(
            service, this.docManager
        );

        this.config.workspaceUri = service.workSpaceDir;

        const packageInfo = service.getPackageFile() as any;
        this.config.project.language = packageInfo.project?.language;
    }

    initSnippets(absolutePath) {
        const snippets = path.join(absolutePath, 'snippets');
        const getText = (fileName: string) => {
            return readFileSync(path.join(snippets, fileName), {
                encoding: 'utf-8'
            });
        };

        const defaultText = getText('default.mahal')
        const htmlText = getText('html.mahal');
        const cssText = getText('style.mahal');
        const scssText = getText('scss.mahal');

        this.savedSnippets.default = defaultText;
        this.savedSnippets.html = htmlText;
        this.savedSnippets.css = cssText;
        this.savedSnippets.style = cssText;
        this.savedSnippets.scss = scssText;
    }

    listen(params: InitializeParams) {
        const connection = this.connection;

        const docManager = this.docManager;

        docManager.setEditorConfig(params.initializationOptions.clientConfig);
        this.initSnippets(params.initializationOptions.absolutePath);
        this.initJsLang(params);

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

        connection.onCodeAction((params: CodeActionParams) => {
            return this.getCodeActions(params);
        })
        connection.onCodeActionResolve((params: CodeAction) => {
            return this.getCodeActionResolve(params);
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

    getActiveDocInfo(uri: string, position: Position) {
        const document = this.getByURI(
            uri
        );

        const region = this.docManager.getRegionAtPosition(
            document,
            position
        );

        // console.log("languageId", languageId);
        const activeLang = this.langs[region ? region.languageId : ''];
        return { activeLang, document, region };
    }

    doComplete(docIdentifier: TextDocumentIdentifier, position: Position) {
        const { activeLang, document, region } = this.getActiveDocInfo(
            docIdentifier.uri, position
        );
        if (activeLang) {
            try {
                return activeLang.doComplete(document, position, region, this.langs['javascript'] as any);
            } catch (error) {
                this.onError(error);
            }
        }
        else {
            let snippetsMap: Array<{ label: string; detail: string; }> = [
                {
                    label: "default",
                    detail: "mahal default snippets"
                }
            ];
            if (position.character === 0) {
                snippetsMap = [
                    ...snippetsMap,
                    {
                        label: "style",
                        detail: "style snippets",
                    }, {
                        label: "css",
                        detail: "css snippets",
                    }, {
                        label: "scss",
                        detail: "scss snippets",
                    }, {
                        label: "html",
                        detail: "html snippets",
                    }
                ]
            }

            const completionItems = snippetsMap.map((item) => {
                let textToInsert: string = this.savedSnippets[item.label];
                if (item.label === 'default') {
                    textToInsert = textToInsert.replace('{{name}}',
                        basename(docIdentifier.uri)
                    ).replace('{{date}}', DateTime.now().toFormat('MMMM dd, yyyy'))
                }
                return {
                    insertText: textToInsert,
                    label: item.label,
                    detail: item.detail,
                    insertTextFormat: InsertTextFormat.Snippet
                } as CompletionItem;
            })
            return CompletionList.create(completionItems, false);
        }
    }

    getCodeActions(params: CodeActionParams) {
        const { activeLang, document } = this.getActiveDocInfo(
            params.textDocument.uri, params.range.start
        );
        if (activeLang) {
            return activeLang.getCodeAction(
                document, params.range, params.context
            );
        }
    }

    getCodeActionResolve(params: CodeAction) {
        const data = params.data as CodeActionData;

        const { activeLang, document } = this.getActiveDocInfo(
            data.uri, data.position
        );
        if (activeLang) {
            return activeLang.getCodeActionResolve(
                document, params
            );
        }
    }

    doHover(docIdentifier: TextDocumentIdentifier, position: Position) {
        const { activeLang, document, region } = this.getActiveDocInfo(
            docIdentifier.uri, position
        );

        if (activeLang) {
            try {
                return activeLang.doHover(document, position, region);
            } catch (error) {
                this.onError(error);
            }
        }
    }

    onError(error) {
        logger.error(`message: ${error.message}, stack: ${error.stack}`);
    }

    doCompletionResolve(item: CompletionItem) {
        const { activeLang } = this.getActiveDocInfo(
            item.data.uri, item.data.position
        );

        if (activeLang) {
            try {
                return activeLang.doResolve(item);
            } catch (error) {
                this.onError(error);
            }
        }
    }

    getReferences(params: ReferenceParams) {
        const { activeLang, document } = this.getActiveDocInfo(
            params.textDocument.uri, params.position
        );

        if (activeLang) {
            try {
                return activeLang.getReferences(
                    document, params.position
                );
            } catch (error) {
                this.onError(error);
            }
        }
    }
    getSignatureHelp(params: SignatureHelpParams) {
        const { activeLang, document } = this.getActiveDocInfo(
            params.textDocument.uri, params.position
        );

        if (activeLang) {
            return activeLang.getSignatureHelp(
                document, params.position
            );
        }
    }

    * eachLang(uri: string) {
        const document = this.getByURI(uri);
        // first return document
        yield document;
        const langs = [];
        document.regions.forEach(region => {
            const id = region.languageId;
            if (this.langs[id]) {
                langs.push(
                    id
                );
            }

        })
        for (const languageId in langs) {
            const lang = this.langs[langs[languageId]];
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
        const { activeLang, document, region } = this.getActiveDocInfo(
            params.textDocument.uri, params.position
        );
        if (activeLang) {
            try {
                return activeLang.getDocumentHighlight(
                    document, params.position, region
                );
            } catch (error) {
                this.onError(error);
            }
        }
    }

    getDefinition(params: DefinitionParams) {
        const { activeLang, document } = this.getActiveDocInfo(
            params.textDocument.uri, params.position
        );
        if (activeLang) {
            try {
                return activeLang.getDefinition(
                    document, params.position
                );
            } catch (error) {
                this.onError(error);
            }
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
            try {
                symbols = symbols.concat(
                    (lang.value as MahalLang).
                        format(
                            document,
                            params.options
                        )
                )
            } catch (error) {
                this.onError(error);
            }
            lang = langs.next();
        }
        return symbols;
    }


}