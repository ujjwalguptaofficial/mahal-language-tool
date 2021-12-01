import { createConnection, ProposedFeatures, TextDocumentSyncKind } from "vscode-languageserver/node";
import { LangManager } from "./lang_manager";



let connection = createConnection(ProposedFeatures.all);
let langManager = new LangManager();

connection.onInitialize((params) => {
    langManager.listen(connection, params);

    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Full,
            // Tell the client that the server supports code completion
            completionProvider: {
                resolveProvider: false,
                triggerCharacters: ['.', '"', '\'', '/', '@', '<']
            },
            // codeActionProvider: true,
            // definitionProvider: true,
            // documentFormattingProvider: true,
            // documentRangeFormattingProvider: true,
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
            hoverProvider: true,
            // renameProvider: true,
            referencesProvider: true,
            signatureHelpProvider: {
                triggerCharacters: ['(', ',']
            },
            // workspaceSymbolProvider: true,
            // implementationProvider: true,
            // typeDefinitionProvider: true,
            // foldingRangeProvider: true
        }
    }
});

connection.onCompletion((params) => {
    try {
        return langManager.doComplete(
            params.textDocument, params.position
        );
    } catch (error) {
        console.log("error", error);
    }
});

connection.onHover((params) => {
    return langManager.doHover(params.textDocument, params.position)
});


connection.onCompletionResolve((params) => {
    return langManager.doCompletionResolve(params);
});

connection.onReferences((params) => {
    return langManager.getReferences(params);
})

connection.onSignatureHelp((params) => {
    return langManager.getSignatureHelp(params);
})
connection.onDocumentSymbol((params) => {
    return langManager.getDocumentSymbols(params);
})
connection.onDocumentHighlight((params) => {
    return langManager.getDocumentHighlight(params);
})


connection.listen();