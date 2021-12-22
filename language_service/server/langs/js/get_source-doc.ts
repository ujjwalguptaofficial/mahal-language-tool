import { Program } from "typescript";
import { TextDocument } from "vscode-languageserver-textdocument";

export function getSourceDoc(fileName: string, program: Program): TextDocument {
    const sourceFile = program.getSourceFile(fileName)!;
    return TextDocument.create(fileName, 'mahal', 0, sourceFile.getFullText());
}