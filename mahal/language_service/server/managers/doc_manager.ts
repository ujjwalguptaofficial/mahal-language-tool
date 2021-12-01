import { LanguageService } from "vscode-html-languageservice";
import { TextDocument } from "vscode-languageserver-textdocument";
import { DidChangeTextDocumentParams, DidCloseTextDocumentParams, DidOpenTextDocumentParams, DidSaveTextDocumentParams, Position, TextDocumentContentChangeEvent } from "vscode-languageserver/node";
import { MahalDoc } from "../models";
import { getEmbeddedDocument } from "../utils";

export class DocManager {

    docs = new Map<string, MahalDoc>();

    private languageService: LanguageService

    constructor(languageService: LanguageService) {
        this.languageService = languageService;
    }

    getByURI(uri: string) {
        return this.docs.get(uri);
    }

    save(document: TextDocument) {
        this.docs.set(
            document.uri,
            new MahalDoc(this.languageService, document)
        )
    }

    didCloseTextDocument(params: DidCloseTextDocumentParams) {
        this.closeDocument(params.textDocument.uri);
    }

    closeDocument(uri: string) {
        this.docs.delete(uri);
    }

    didSaveTextDocument(_params: DidSaveTextDocumentParams) {
        // do nothing
    }

    onOpenTextDocument(params: DidOpenTextDocumentParams) {
        const { textDocument } = params;
        this.save(
            TextDocument.create(
                textDocument.uri, textDocument.languageId,
                textDocument.version, textDocument.text
            )
        );
    }

    didChangeTextDocument(params: DidChangeTextDocumentParams) {
        const { textDocument } = params;
        const document = this.getByURI(
            textDocument.uri
        );
        if (!document) {
            throw new Error('Received change on non-opened document ' + textDocument.uri);
        }
        if (textDocument.version == null) {
            throw new Error(`Received document change event for ${textDocument.uri} without valid version identifier`);
        }

        for (const change of params.contentChanges) {
            let line = 0;
            let offset = 0;
            let endLine = 0;
            let endOffset = 0;
            if (TextDocumentContentChangeEvent.isIncremental(change)) {
                line = change.range.start.line + 1;
                offset = change.range.start.character + 1;
                endLine = change.range.end.line + 1;
                endOffset = change.range.end.character + 1;
            } else {
                line = 1;
                offset = 1;
                const endPos = document.positionAt(document.getText().length);
                endLine = endPos.line + 1;
                endOffset = endPos.character + 1;
            }
            document.applyEdit(textDocument.version, change);
        }
    }

    getEmbeddedDocument(uri: string, languageId: string, ignoreAttributeValues?: boolean): TextDocument {
        const doc = this.getByURI(uri);
        if (doc) {
            const region = this.getByURI(uri).regions

            return getEmbeddedDocument(
                doc.textDoc,
                region,
                languageId,
                ignoreAttributeValues
            )
        }

        return TextDocument.create(
            uri,
            languageId, 0, ''
        )
    }

    getLanguageAtPosition(document: TextDocument, position: Position) {
        const regions = this.getByURI(document.uri).regions;
        const offset = document.offsetAt(position);

        const region = regions.find(region => {
            if (offset >= region.start && offset <= region.end) {
                return true;
            }
            return false;
        })
        if (region) {
            return region.languageId;
        }
        // console.log("regions", regions);
        return 'unknown';
    }
}