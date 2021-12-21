import { getURLFromPath } from "../../utils";
import { FileTextChanges, LanguageService } from "typescript";
import { TextEdit } from "vscode-languageserver/node";
import { convertRange } from "./convert_range";
import { getSourceDoc } from "./get_source-doc";

export function createUriMappingForEdits(changes: FileTextChanges[], service: LanguageService) {
    const program = service.getProgram()!;
    const result: Record<string, TextEdit[]> = {};
    for (const { fileName, textChanges } of changes) {
        const targetDoc = getSourceDoc(fileName, program);
        const edits = textChanges.map(({ newText, span }) => ({
            newText,
            range: convertRange(targetDoc, span)
        }));
        const uri = getURLFromPath(fileName);
        if (result[uri]) {
            result[uri].push(...edits);
        } else {
            result[uri] = edits;
        }
    }
    return result;
}