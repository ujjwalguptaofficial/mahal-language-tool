import { MahalDoc } from "../../models";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Range } from "vscode-languageserver/node";
import { TextSpan } from "typescript";

export function convertRange(document: TextDocument | MahalDoc, span: TextSpan, relativeStart = 0): Range {
    const start = span.start + relativeStart;
    const startPosition = document.positionAt(start);
    const endPosition = document.positionAt(start + span.length);
    return Range.create(startPosition, endPosition);
}