import { CompletionList, Diagnostic, ProposedFeatures, RequestType, TextDocumentPositionParams, TextDocuments, TextDocumentSyncKind } from "vscode-languageserver";
import { createConnection } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { getLanguageModes } from "./helpers";
import { ILanguageMode, ILanguageModes } from "./interfaces";
namespace TagCloseRequest {
    export const type: RequestType<TextDocumentPositionParams, string | null, any> =
        new RequestType('html/tag');
}

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let languageModes: ILanguageModes;

connection.onInitialize(params => {
    console.log('initialized called');
    languageModes = getLanguageModes()
    documents.onDidClose(e => {
        languageModes.onDocumentRemoved(e.document);
    });
    connection.onShutdown(() => {
        languageModes.dispose();
    });

    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Full,
            // Tell the client that the server supports code completion
            completionProvider: {
                resolveProvider: false
            }
        }
    }
});

connection.onDidChangeWatchedFiles(_change => {
    // Monitored files have change in VSCode
    connection.console.log('We received an file change event');
});

connection.onDidChangeConfiguration(_change => {
    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});

connection.onRequest(TagCloseRequest.type, (evt) => {
    const document = documents.get(evt.textDocument.uri);
    if (!document) {
        return null;
    }

    const mode = languageModes.getModeAtPosition(
        document, evt.position
    );

    if (mode) {
        const doTagComplete = mode.doTagComplete;
        if (doTagComplete) {
            return doTagComplete(evt.textDocument as any, evt.position);
        }
    }
});

connection.onCompletion(async (textDocumentPosition, token) => {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (!document) {
        return null;
    }

    const mode = languageModes.getModeAtPosition(document, textDocumentPosition.position);

    if (mode) {
        const doComplete = mode.doComplete;
        if (doComplete) {
            return doComplete(document, textDocumentPosition.position);
        }
    }
    return CompletionList.create();

});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument) {
    try {
        const version = textDocument.version;
        const diagnostics: Diagnostic[] = [];
        if (textDocument.languageId === 'mahal') {
            const modes = languageModes.getAllModesInDocument(textDocument);
            const latestTextDocument = documents.get(textDocument.uri);
            if (latestTextDocument && latestTextDocument.version === version) {
                // check no new version has come in after in after the async op
                modes.forEach(mode => {
                    if (mode.doValidation) {
                        mode.doValidation(latestTextDocument).forEach(d => {
                            diagnostics.push(d);
                        });
                    }
                });
                connection.sendDiagnostics({ uri: latestTextDocument.uri, diagnostics });
            }
        }
    } catch (e) {
        connection.console.error(`Error while validating ${textDocument.uri}`);
        connection.console.error(String(e));
    }
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
