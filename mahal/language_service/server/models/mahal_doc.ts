import { LanguageService } from "vscode-html-languageservice";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TextDocumentContentChangeEvent, Range, Position } from "vscode-languageserver/node";
import { getRangeFromXmlNode, getContentFromXmlNode } from "../helpers";
import { EmbeddedRegion } from "../interfaces";
import { getEmbeddedDocument } from "../utils";


export class MahalDoc {

    regions: EmbeddedRegion[];

    textDoc: TextDocument

    constructor(private languageService: LanguageService, document: TextDocument) {
        this.setTextDoc(
            document
        )
    }

    setTextDoc(document: TextDocument) {
        this.textDoc = document;
        this.regions = this.getDocumentRegions(
            this.languageService, document
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



    private getDocumentRegions(languageService: LanguageService, document: TextDocument) {
        const regions: EmbeddedRegion[] = [];
        const scanner = languageService.createScanner(document.getText());
        let lastTagName = '';
        let lastAttributeName: string | null = null;
        let languageIdFromType: string | undefined = undefined;
        const importedScripts: string[] = [];

        // let token = scanner.scan();
        const fullText = document.getText();
        let result = getRangeFromXmlNode(fullText, 'html');
        const htmlStart = result.start;
        const htmlEnd = result.end;
        if (htmlStart && htmlEnd) {
            console.log("pushed html", result);
            regions.push({ languageId: 'html', start: htmlStart, end: htmlEnd });
        }

        result = getRangeFromXmlNode(fullText, 'style');
        const styleStart = result.start;
        const styleEnd = result.end;
        if (styleStart && styleEnd) {
            console.log("pushed css", result);
            regions.push({ languageId: 'css', start: styleStart, end: styleEnd });
        }

        result = getRangeFromXmlNode(fullText, 'script');
        const scriptStart = result.start;
        const scriptEnd = result.end;
        if (scriptStart && scriptEnd) {
            // console.log("pushed script", result, getContentFromXmlNode(fullText,'script').length);
            regions.push({ languageId: 'javascript', start: scriptStart, end: scriptEnd });
        }


        // while (token !== TokenType.EOS) {
        //     console.log("token", scanner.getTokenText());
        //     switch (token) {
        //         case TokenType.StartTag:
        //             lastTagName = scanner.getTokenText();
        //             lastAttributeName = null;
        //             languageIdFromType = 'javascript';

        //             if (lastTagName === 'html') {
        //                 // console.log("html tag", "start", scanner.getTokenOffset(), "end", scanner.getTokenEnd());
        //                 // console.log('text', scanner.getTokenText());
        //                 // let start, end, htmlEndTagFound = false;
        //                 // do {
        //                 //     token = scanner.scan();
        //                 //     if (token === TokenType.StartTagClose) {
        //                 //         start = scanner.getTokenEnd();
        //                 //     }
        //                 //     else if (token === TokenType.EndTagOpen) {
        //                 //         end = scanner.getTokenOffset();
        //                 //     }
        //                 //     else if (token === TokenType.EndTag && scanner.getTokenText() === 'html') {
        //                 //         htmlEndTagFound = true;
        //                 //     }
        //                 //     console.log('token', token, scanner.getTokenText());
        //                 // } while (token !== TokenType.EOS && htmlEndTagFound === false)
        //                 // console.log("html tassg", "start", start, "end", end, "offset", scanner.getTokenOffset(), "end", scanner.getTokenEnd());
        //                 // console.log('text', scanner.getTokenText());
        //                 const { start, end } = getRangeFromXmlNode(fullText, 'html');
        //                 if (start && end) {
        //                     console.log("pushed html")
        //                     regions.push({ languageId: 'html', start: start + 1, end: end });
        //                 }
        //             }
        //             break;
        //         // case TokenType.:
        //         //     regions.push({ languageId: 'css', start: scanner.getTokenOffset(), end: scanner.getTokenEnd() });
        //         //     break;
        //         case TokenType.Styles:
        //             console.log("css tag", "start", scanner.getTokenOffset(), "end", scanner.getTokenEnd());
        //             regions.push({ languageId: 'css', start: scanner.getTokenOffset(), end: scanner.getTokenEnd() });
        //             break;
        //         case TokenType.Script:
        //             regions.push({ languageId: 'javascript', start: scanner.getTokenOffset(), end: scanner.getTokenEnd() });
        //             break;
        //         case TokenType.AttributeName:
        //             lastAttributeName = scanner.getTokenText();
        //             break;
        //         case TokenType.AttributeValue:
        //             if (lastAttributeName === 'src' && lastTagName.toLowerCase() === 'script') {
        //                 let value = scanner.getTokenText();
        //                 if (value[0] === '\'' || value[0] === '"') {
        //                     value = value.substr(1, value.length - 1);
        //                 }
        //                 importedScripts.push(value);
        //             } else if (lastAttributeName === 'type' && lastTagName.toLowerCase() === 'script') {
        //                 if (/["'](module|(text|application)\/(java|ecma)script|text\/babel)["']/.test(scanner.getTokenText())) {
        //                     languageIdFromType = 'javascript';
        //                 } else if (/["']text\/typescript["']/.test(scanner.getTokenText())) {
        //                     languageIdFromType = 'typescript';
        //                 } else {
        //                     languageIdFromType = undefined;
        //                 }
        //             } else {
        //                 const attributeLanguageId = getAttributeLanguage(lastAttributeName!);
        //                 if (attributeLanguageId) {
        //                     let start = scanner.getTokenOffset();
        //                     let end = scanner.getTokenEnd();
        //                     const firstChar = document.getText()[start];
        //                     if (firstChar === '\'' || firstChar === '"') {
        //                         start++;
        //                         end--;
        //                     }
        //                     regions.push({ languageId: attributeLanguageId, start, end, attributeValue: true });
        //                 }
        //             }
        //             lastAttributeName = null;
        //             break;
        //     }
        //     token = scanner.scan();
        // }
        return regions;
    }

    // getRegionByLanguage(languageId: string) {
    //     return this.regions.find(region => region.languageId === languageId);
    // }
}