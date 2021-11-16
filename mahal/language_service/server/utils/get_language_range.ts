import { TextDocument } from "vscode-languageserver-textdocument";
import { EmbeddedRegion, ILanguageRange } from "../interfaces";
import { Position, Range } from "vscode-languageserver";

export function getLanguageRanges(document: TextDocument, regions: EmbeddedRegion[], range: Range): ILanguageRange[] {
    const result: ILanguageRange[] = [];
    let currentPos = range ? range.start : Position.create(0, 0);
    let currentOffset = range ? document.offsetAt(range.start) : 0;
    const endOffset = range ? document.offsetAt(range.end) : document.getText().length;
    for (const region of regions) {
        if (region.end > currentOffset && region.start < endOffset) {
            const start = Math.max(region.start, currentOffset);
            const startPos = document.positionAt(start);
            if (currentOffset < region.start) {
                result.push({
                    start: currentPos,
                    end: startPos,
                    languageId: 'html'
                });
            }
            const end = Math.min(region.end, endOffset);
            const endPos = document.positionAt(end);
            if (end > region.start) {
                result.push({
                    start: startPos,
                    end: endPos,
                    languageId: region.languageId,
                    attributeValue: region.attributeValue
                });
            }
            currentOffset = end;
            currentPos = endPos;
        }
    }
    if (currentOffset < endOffset) {
        const endPos = range ? range.end : document.positionAt(endOffset);
        result.push({
            start: currentPos,
            end: endPos,
            languageId: 'html'
        });
    }
    return result;
}
