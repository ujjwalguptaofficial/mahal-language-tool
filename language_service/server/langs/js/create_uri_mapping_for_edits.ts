import { getURLFromPath } from "../../utils";
import { FileTextChanges, LanguageService } from "typescript";
import { TextEdit } from "vscode-languageserver/node";
import { convertRange } from "./convert_range";
import { JsLang } from ".";

export function createUriMappingForEdits(changes: FileTextChanges[], service: JsLang, startPosition?: number) {
    // const program = service.getProgram()!;
    const result: Record<string, TextEdit[]> = {};
    for (const { fileName, textChanges } of changes) {
        const targetDoc = service.docManager.getByPath(fileName);
        const edits = textChanges.map(({ newText, span }) => {
            return {
                newText,
                range: convertRange(targetDoc, span, startPosition)
            }
        });
        const uri = getURLFromPath(fileName);
        if (result[uri]) {
            result[uri].push(...edits);
        } else {
            result[uri] = edits;
        }
    }
    return result;
}