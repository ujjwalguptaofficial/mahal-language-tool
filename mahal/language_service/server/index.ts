import { CompletionList, Diagnostic, ProposedFeatures, TextDocuments, TextDocumentSyncKind } from "vscode-languageserver";
import { createConnection } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { getLanguageModes } from "./helpers";
import { ILanguageMode, ILanguageModes } from "./interfaces";

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let languageModes: ILanguageModes;
console.log("languageModes", languageModes);

connection.onInitialize(params => {
    connection.console.log('initialized called');
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

connection.onDidChangeConfiguration(_change => {
    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});

connection.onCompletion(async (textDocumentPosition, token) => {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (!document) {
        return null;
    }

    const mode = languageModes.getModeAtPosition(document, textDocumentPosition.position);
    if (!mode || !mode.doComplete) {
        return CompletionList.create();
    }
    const doComplete = mode.doComplete!;

    return doComplete(document, textDocumentPosition.position);
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
        if (textDocument.languageId === 'html1') {
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
