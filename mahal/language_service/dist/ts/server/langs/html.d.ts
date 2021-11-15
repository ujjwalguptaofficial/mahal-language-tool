import { CompletionList, LanguageService, TextDocument } from "vscode-html-languageservice";
import { Position } from "vscode-languageserver-textdocument";
import { MahalLang } from "../abstracts";
import { ILangCache, IMahalDocCache } from "../interfaces";
export declare class HtmlLang extends MahalLang {
    private langService;
    private documentCache;
    constructor(langService: LanguageService, documentCache: ILangCache<IMahalDocCache>);
    get id(): string;
    private getDoc_;
    doComplete(document: TextDocument, position: Position): Promise<CompletionList>;
}
