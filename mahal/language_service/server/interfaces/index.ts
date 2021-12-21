import { Position } from "vscode-languageserver/node";
import { LanguageId } from "../types";

export * from "./language_range";
export * from "./embedded_region";
export * from "./semantic_token_offsite_data";

export enum CodeActionDataKind {
  CombinedCodeFix,
  RefactorAction,
  OrganizeImports
}

export interface BaseCodeActionData {
  uri: string;
  languageId: LanguageId;
  kind: CodeActionDataKind;
  textRange: { pos: number; end: number };
  position?: Position;
}

export interface RefactorActionData extends BaseCodeActionData {
  kind: CodeActionDataKind.RefactorAction;
  refactorName: string;
  actionName: string;
  description: string;
  notApplicableReason?: string;
}

export interface CombinedFixActionData extends BaseCodeActionData {
  kind: CodeActionDataKind.CombinedCodeFix;
  fixId: {};
}

export interface OrganizeImportsActionData extends BaseCodeActionData {
  kind: CodeActionDataKind.OrganizeImports;
}

export type CodeActionData = RefactorActionData | CombinedFixActionData | OrganizeImportsActionData;