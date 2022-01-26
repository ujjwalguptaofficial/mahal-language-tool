import { EventEmitter } from "stream";
import { IndentStyle } from "typescript";
import { LanguageService } from "vscode-html-languageservice";
import { TextDocument } from "vscode-languageserver-textdocument";
import { DidChangeTextDocumentParams, DidChangeWatchedFilesParams, DidCloseTextDocumentParams, DidOpenTextDocumentParams, DidSaveTextDocumentParams, FileChangeType, Position, TextDocumentContentChangeEvent } from "vscode-languageserver/node";
import { DOC_EVENT } from "../enums";
import { EmbeddedRegion } from "../interfaces";
import { MahalDoc } from "../models";
import { getEmbeddedDocument, getFilePathFromURL } from "../utils";

interface IEditorScriptFormat {
    enable: boolean;
    convertTabsToSpaces: boolean;
    insertSpaceAfterCommaDelimiter: boolean;
    insertSpaceAfterConstructor: false;
    insertSpaceAfterFunctionKeywordForAnonymousFunctions: true;
    insertSpaceAfterKeywordsInControlFlowStatements: true;
    insertSpaceAfterOpeningAndBeforeClosingEmptyBraces: true;
    insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true;
    insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: true;
    insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: false;
    insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: false;
    insertSpaceAfterSemicolonInForStatements: true;
    insertSpaceBeforeAndAfterBinaryOperators: true;
}

interface IEditorConfig {
    tabSize: number;
    indentSize: number;
    script: {
        format: IEditorScriptFormat;
        validate: boolean;
    },
    indentStyle: IndentStyle;
}

export class DocManager {


    externalDocs = new Map<string, number>();

    docs = new Map<string, MahalDoc>();

    private eventBus_ = new EventEmitter();

    private languageService: LanguageService

    constructor(languageService: LanguageService) {
        this.languageService = languageService;
    }

    editorConfig: IEditorConfig;

    setEditorConfig(config: IEditorConfig) {
        const scriptFormat = config.script.format;
        const defaultScriptFormat: IEditorScriptFormat = {
            enable: true,
            convertTabsToSpaces: false,
            insertSpaceAfterCommaDelimiter: true,
            insertSpaceAfterConstructor: false,
            insertSpaceAfterFunctionKeywordForAnonymousFunctions: true,
            insertSpaceAfterKeywordsInControlFlowStatements: true,
            insertSpaceAfterOpeningAndBeforeClosingEmptyBraces: true,
            insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
            insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: true,
            insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: false,
            insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: false,
            insertSpaceAfterSemicolonInForStatements: true,
            insertSpaceBeforeAndAfterBinaryOperators: true,
        };
        this.editorConfig = {
            tabSize: 4,
            indentSize: 4,
            script: {
                format: Object.assign(defaultScriptFormat, scriptFormat),
                validate: true
            },
            indentStyle: IndentStyle.None,
        }
    }

    onExternalDocChange(param: DidChangeWatchedFilesParams) {
        // console.log('We received a file change event');
        param.changes.forEach(async c => {
            if (c.type === FileChangeType.Changed) {
                const path = getFilePathFromURL(c.uri);
                const version = this.externalDocs.get(path) || 0;
                this.externalDocs.set(
                    path,
                    version + 1
                )
            }
        })
    }

    on(event: DOC_EVENT, cb: Function) {
        this.eventBus_.on(event, cb as any);
    }

    emit(event: DOC_EVENT, ...args) {
        this.eventBus_.emit(event, ...args);
    }

    getByPath(uri: string) {
        return this.docs.get(uri);
    }

    getByURI(uri: string) {
        return this.docs.get(
            getFilePathFromURL(uri)
        );
    }

    isDocExist(uri: string) {
        return this.getByPath(uri) != null;
    }

    save(document: TextDocument) {
        this.docs.set(
            getFilePathFromURL(document.uri),
            new MahalDoc(this.languageService, document)
        )
    }

    didCloseTextDocument(params: DidCloseTextDocumentParams) {
        this.closeDocument(params.textDocument.uri);
    }

    closeDocument(uri: string) {
        this.docs.delete(uri);
        this.emit(DOC_EVENT.RemoveDocument, uri);
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
        this.eventBus_.emit(DOC_EVENT.AddDocument, textDocument.uri);
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
        document.applyEdit(textDocument.version, params.contentChanges);

        // for (const change of params.contentChanges) {
        // let line = 0;
        // let offset = 0;
        // let endLine = 0;
        // let endOffset = 0;
        // if (TextDocumentContentChangeEvent.isIncremental(change)) {
        //     line = change.range.start.line + 1;
        //     offset = change.range.start.character + 1;
        //     endLine = change.range.end.line + 1;
        //     endOffset = change.range.end.character + 1;
        // } else {
        //     line = 1;
        //     offset = 1;
        //     const endPos = document.positionAt(document.getText().length);
        //     endLine = endPos.line + 1;
        //     endOffset = endPos.character + 1;
        // }
        // document.applyEdit(textDocument.version, change);
        // }
    }

    getEmbeddedDocument(uri: string, region: EmbeddedRegion, ignoreAttributeValues?: boolean) {
        const doc = this.getByURI(uri);
        if (doc) {

            return getEmbeddedDocument(
                doc.textDoc,
                region,
                ignoreAttributeValues
            )
        }

        return TextDocument.create(
            uri,
            region.languageId, 0, ''
        );
    }

    getRegionAtPosition(document: MahalDoc, position: Position) {
        const regions = document.regions;
        const offset = document.offsetAt(position);

        const region = regions.find(region => {
            if (offset >= region.start && offset <= region.end) {
                return true;
            }
            return false;
        })
        return region;
    }

}