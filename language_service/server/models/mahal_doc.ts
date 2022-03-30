import { LanguageService, Scanner, TokenType } from "vscode-html-languageservice";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextDocumentContentChangeEvent, Range, Position } from "vscode-languageserver/node";
import { EmbeddedRegion, IAppConfig } from "../interfaces";
import { LanguageId } from "../types";


export class MahalDoc {

    regions: EmbeddedRegion[];

    textDoc: TextDocument

    constructor(private appConfig: IAppConfig, document: TextDocument) {
        this.setTextDoc(
            document
        )
    }

    setTextDoc(document: TextDocument) {
        this.textDoc = document;
        this.regions = this.getDocumentRegions(
            document
        )
    }

    get version() {
        return this.textDoc.version;
    }

    getText(range?: Range): string {
        return this.textDoc.getText(range);
    }

    positionAt(offset: number) {
        return this.textDoc.positionAt(offset);
    }

    offsetAt(position: Position) {
        return this.textDoc.offsetAt(position);
    }

    get uri(): string {
        return this.textDoc.uri;
    }

    get languageId(): string {
        return this.textDoc.languageId;
    }

    scriptLanguage = 'js';

    applyEdit(version: number, changes: TextDocumentContentChangeEvent[]): void {
        let content = this.getText();
        // let newContent = change.text;
        changes.forEach(change => {
            if (TextDocumentContentChangeEvent.isIncremental(change)) {
                const start = this.offsetAt(change.range.start);
                const end = this.offsetAt(change.range.end);
                content = content.substr(0, start) + change.text + content.substr(end);
            }
            else {
                content = change.text;
            }
        });
        // console.log("newcontent", content);
        this.setTextDoc(
            TextDocument.create(
                this.uri,
                this.languageId,
                version, content
            )
        );
    }
    // applyEdit(version: number, change: TextDocumentContentChangeEvent): void {
    //     const content = this.getText();
    //     let newContent = change.text;
    //     if (TextDocumentContentChangeEvent.isIncremental(change)) {
    //         const start = this.offsetAt(change.range.start);
    //         const end = this.offsetAt(change.range.end);
    //         newContent = content.substr(0, start) + change.text + content.substr(end);
    //     }
    //     this.setTextDoc(
    //         TextDocument.create(
    //             this.uri,
    //             this.languageId,
    //             version, newContent
    //         )
    //     );
    // }



    private getDocumentRegions(document: TextDocument) {
        const languageService = this.appConfig.hmlLanguageService;
        const language = this.appConfig.project.language;

        const regions: EmbeddedRegion[] = [];
        const text = document.getText();
        const scanner = languageService.createScanner(text);
        let lastTagName = '';
        let lastAttributeName = '';
        let languageIdFromType = '';
        // const importedScripts: string[] = [];
        let stakes = 0;

        let token = scanner.scan();
        while (token !== TokenType.EOS) {
            switch (token) {
                case TokenType.Styles:
                    regions.push({
                        languageId: /^(sass|scss|less|postcss|stylus)$/.test(languageIdFromType)
                            ? (languageIdFromType)
                            : 'css',
                        start: scanner.getTokenOffset(),
                        end: scanner.getTokenEnd()
                    });
                    languageIdFromType = '';
                    break;
                case TokenType.Script:
                    this.scriptLanguage = languageIdFromType || language;
                    regions.push({
                        languageId: 'javascript',
                        start: scanner.getTokenOffset(),
                        end: scanner.getTokenEnd(),
                    });
                    languageIdFromType = '';
                    break;
                case TokenType.StartTag:
                    stakes++;
                    const tagName = scanner.getTokenText();
                    if (tagName === 'html' && stakes === 1) {
                        const templateRegion = scanRegion(tagName, scanner, text);
                        if (templateRegion) {
                            regions.push(templateRegion);
                        }

                    }
                    // else if (!['style', 'script'].includes(tagName) && stakes === 1) {
                    //     const customRegion = scanCustomRegion(tagName, scanner, text);
                    //     if (customRegion) {
                    //         regions.push(customRegion);
                    //     }
                    // }
                    lastTagName = tagName;
                    lastAttributeName = '';
                    break;
                case TokenType.AttributeName:
                    lastAttributeName = scanner.getTokenText();
                    break;
                case TokenType.AttributeValue:
                    if (lastAttributeName === 'lang') {
                        languageIdFromType = getLanguageIdFromLangAttr(scanner.getTokenText());
                    }
                    lastAttributeName = '';
                    break;
                case TokenType.StartTagSelfClose:
                case TokenType.EndTagClose:
                    stakes--;
                    lastAttributeName = '';
                    languageIdFromType = '';
                    break;
                default:
                    const commentText = scanner.getTokenText().trim();
                    if (commentText.substring(0, 3) === '---' && commentText.substr(-3) === '---') {
                        regions.push({
                            start: scanner.getTokenOffset() + 3,
                            end: commentText.length - 3,
                            languageId: 'yml'
                        })
                    }

            }
            token = scanner.scan();
        }
        // console.log('regions', regions);
        return regions;
    }
}

export function removeQuotes(str: string) {
    return str.replace(/["']/g, '');
}


function getLanguageIdFromLangAttr(lang: string): LanguageId {
    let languageIdFromType = removeQuotes(lang);
    // if (languageIdFromType === 'jade') {
    //     languageIdFromType = 'pug';
    // }
    // if (languageIdFromType === 'ts') {
    //     languageIdFromType = 'typescript';
    // }
    return languageIdFromType as LanguageId;
}


function scanRegion(tagName: string, scanner: Scanner, text: string): EmbeddedRegion | null {

    let token = -1;
    let start = 0;
    let end: number;

    // Scan until finding matching template EndTag
    // Also record immediate next StartTagClose to find start
    let unClosedTag = 1;
    // let lastAttributeName = null;
    while (unClosedTag !== 0) {
        token = scanner.scan();

        if (token === TokenType.EOS) {
            return null;
        }

        if (start === 0) {
            if (token === TokenType.StartTagClose) {
                start = scanner.getTokenEnd();
            }
        } else {
            if (token === TokenType.StartTag && scanner.getTokenText() === tagName) {
                unClosedTag++;
            } else if (token === TokenType.EndTag && scanner.getTokenText() === tagName) {
                unClosedTag--;
                // test leading </${tagName}>
                const charPosBeforeEndTag = scanner.getTokenOffset() - 3;
                if (text[charPosBeforeEndTag] === '\n') {
                    break;
                }
            } else if (token === TokenType.Unknown) {
                if (scanner.getTokenText().charAt(0) === '<') {
                    const offset = scanner.getTokenOffset();
                    const unknownText = text.substr(offset, `</${tagName}>`.length);
                    if (unknownText === `</${tagName}>`) {
                        unClosedTag--;
                        // test leading </${tagName}>
                        if (text[offset - 1] === '\n') {
                            return {
                                languageId: tagName,
                                start,
                                end: offset,
                            };
                        }
                    }
                }
            }
        }
    }

    // In EndTag, find end
    // -2 for </
    end = scanner.getTokenOffset() - 2;

    const content = text.substring(start, end);

    // console.log('before', 'start', start, 'end', end);
    // console.log('beforetext', `"${text.substring(start, end)}"`);

    start += content.length - content.trimStart().length;
    end -= content.length - content.trimEnd().length;

    // console.log('content length', content.length, "trimEnd", content.trimEnd().length);
    // console.log('start', start, 'end', end);

    // console.log('text', `"${text.substring(start, end)}"`);

    return {
        languageId: tagName,
        start,
        end,
    };
}