import { CodeActionKind, createConnection, ProposedFeatures, SemanticTokenModifiers, SemanticTokensLegend, SemanticTokenTypes, TextDocumentSyncKind } from "vscode-languageserver/node";
import { TokenModifier, TokenType } from "./constants";
import { LangManager } from "./lang_manager";



let connection = createConnection(ProposedFeatures.all);
let langManager = new LangManager(connection);
export function getSemanticTokenLegends(): SemanticTokensLegend {
    const tokenModifiers: string[] = [];

    ([
        [TokenModifier.declaration, SemanticTokenModifiers.declaration],
        [TokenModifier.static, SemanticTokenModifiers.static],
        [TokenModifier.async, SemanticTokenModifiers.async],
        [TokenModifier.readonly, SemanticTokenModifiers.readonly],
        [TokenModifier.defaultLibrary, SemanticTokenModifiers.defaultLibrary],
        [TokenModifier.local, 'local'],


        [TokenModifier.refValue, 'refValue']
    ] as const).forEach(([tsModifier, legend]) => (tokenModifiers[tsModifier] = legend));

    const tokenTypes: string[] = [];

    ([
        [TokenType.class, SemanticTokenTypes.class],
        [TokenType.enum, SemanticTokenTypes.enum],
        [TokenType.interface, SemanticTokenTypes.interface],
        [TokenType.namespace, SemanticTokenTypes.namespace],
        [TokenType.typeParameter, SemanticTokenTypes.typeParameter],
        [TokenType.type, SemanticTokenTypes.type],
        [TokenType.parameter, SemanticTokenTypes.parameter],
        [TokenType.variable, SemanticTokenTypes.variable],
        [TokenType.enumMember, SemanticTokenTypes.enumMember],
        [TokenType.property, SemanticTokenTypes.property],
        [TokenType.function, SemanticTokenTypes.function],

        // member is renamed to method in vscode codebase to match LSP default
        [TokenType.member, SemanticTokenTypes.method]
    ] as const).forEach(([tokenType, legend]) => (tokenTypes[tokenType] = legend));

    return {
        tokenModifiers,
        tokenTypes
    };
}

connection.onInitialize((params) => {
    // console.log("init option", params.initializationOptions.clientConfig);
    langManager.listen(params);

    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Full,
            // Tell the client that the server supports code completion
            completionProvider: {
                resolveProvider: false,
                triggerCharacters: ['.', '"', '\'', '/', '@', '<']
            },
            semanticTokensProvider: {
                range: true,
                full: true,
                legend: getSemanticTokenLegends()
            },
            // codeActionProvider: true,
            definitionProvider: true,
            documentFormattingProvider: true,
            documentRangeFormattingProvider: true,
            documentHighlightProvider: true,
            documentSymbolProvider: true,
            // executeCommandProvider: {
            //     commands: [
            //         // Commands.APPLY_WORKSPACE_EDIT,
            //         // Commands.APPLY_CODE_ACTION,
            //         // Commands.APPLY_REFACTORING,
            //         // Commands.ORGANIZE_IMPORTS,
            //         // Commands.APPLY_RENAME_FILE
            //     ]
            // },
            codeActionProvider: {
                codeActionKinds: [
                    CodeActionKind.QuickFix,
                    CodeActionKind.Refactor,
                    CodeActionKind.RefactorExtract,
                    CodeActionKind.RefactorInline,
                    CodeActionKind.RefactorRewrite,
                    CodeActionKind.Source,
                    CodeActionKind.SourceOrganizeImports,
                ],
                resolveProvider: true
            },
            hoverProvider: true,
            // renameProvider: true,
            referencesProvider: true,
            signatureHelpProvider: {
                triggerCharacters: ['(', ',']
            },
            colorProvider: true,
            // workspaceSymbolProvider: true,
            // implementationProvider: true,
            // typeDefinitionProvider: true,
            // foldingRangeProvider: true
        }
    }
});





// connection.languages.


connection.listen();