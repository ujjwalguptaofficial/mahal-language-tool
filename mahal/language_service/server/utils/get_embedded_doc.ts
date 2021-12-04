import { TextDocument } from "vscode-languageserver-textdocument";
import { EmbeddedRegion } from "../interfaces";

export function getEmbeddedDocument(document: TextDocument, regions: EmbeddedRegion[], languageId: string, ignoreAttributeValues: boolean) {
    let currentPos = 0;
    const oldContent = document.getText();
    let result = '';
    let lastSuffix = '';
    const languageRegions = regions.filter(item => item.languageId === languageId);
    languageRegions.forEach(region => {
        if ((!ignoreAttributeValues || !region.attributeValue)) {
            // result = substituteWithWhitespace(result, currentPos, region.start, oldContent, lastSuffix, getPrefix(region));
            result += oldContent.substring(region.start, region.end);
            currentPos = region.end;
            lastSuffix = getSuffix(region);
        }
    })
    // result = substituteWithWhitespace(result, currentPos, oldContent.length, oldContent, lastSuffix, '');
    return {
        doc: TextDocument.create(document.uri, languageId, document.version, result),
        regions: languageRegions
    }
}


const CSS_STYLE_RULE = '__';

function getPrefix(c: EmbeddedRegion) {
    if (c.attributeValue) {
        switch (c.languageId) {
            case 'css': return CSS_STYLE_RULE + '{';
        }
    }
    return '';
}
function getSuffix(c: EmbeddedRegion) {
    if (c.attributeValue) {
        switch (c.languageId) {
            case 'css': return '}';
            case 'javascript': return ';';
        }
    }
    return '';
}

function substituteWithWhitespace(result: string, start: number, end: number, oldContent: string, before: string, after: string) {
    let accumulatedWS = 0;
    result += before;
    for (let i = start + before.length; i < end; i++) {
        const ch = oldContent[i];
        if (ch === '\n' || ch === '\r') {
            // only write new lines, skip the whitespace
            accumulatedWS = 0;
            result += ch;
        } else {
            accumulatedWS++;
        }
    }
    result = append(result, ' ', accumulatedWS - after.length);
    result += after;
    return result;
}

function append(result: string, str: string, n: number): string {
    while (n > 0) {
        if (n & 1) {
            result += str;
        }
        n >>= 1;
        str += str;
    }
    return result;
}

function getAttributeLanguage(attributeName: string): string | null {
    const match = attributeName.match(/^(style)$|^(on\w+)$/i);
    console.log("match", match);
    if (!match) {
        return null;
    }
    return match[1] ? 'css' : 'javascript';
}
