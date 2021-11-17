import { readFileSync, } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { createLanguageService, LanguageServiceHost, findConfigFile, sys, CompilerOptions, getDefaultLibFilePath, ScriptSnapshot, createLanguageServiceSourceFile, createDocumentRegistry } from "typescript";
import { InitializeParams } from "vscode-languageserver-protocol";
import { getContentFromXmlNode, getRangeFromXmlNode } from "../helpers";
import { DocManager } from "../managers";


export function getTypescriptService(params: InitializeParams, docManager: DocManager) {

    const workspace = params.workspaceFolders;
    if (workspace.length === 0) {
        return console.error("no workspace found");
    }

    const activeWorkSpace = workspace[0];

    const workSpaceDir = fileURLToPath(activeWorkSpace.uri);

    console.log('searchDir', workSpaceDir);


    const tsConfigPath = findConfigFile(process.cwd(), sys.fileExists, 'tsconfig.json') ||
        findConfigFile(workSpaceDir, sys.fileExists, 'jsconfig.json');
    let tsConfig;
    if (tsConfigPath) {
        tsConfig = readFileSync(tsConfigPath, {
            encoding: 'utf8'
        });

        console.log('file', tsConfig);
    }
    else {
        tsConfig = {
            allowJs: true,
            declaration: false,

        } as CompilerOptions
    }

    console.log('path', tsConfigPath);


    const fileNames = sys.readDirectory(
        workSpaceDir, ['mahal', 'mhl']
    ).map(item => {
        return item + ".ts";
    })
    console.log("dir", fileNames);
    const getFileName = (fileName: string) => {
        return fileName.substr(0, fileName.length - 3)
    }
    // activeWorkSpace.uri
    const host: LanguageServiceHost = {
        getCompilationSettings() {
            return tsConfig
        },
        getCurrentDirectory() {
            return workSpaceDir
        },
        getDefaultLibFileName(options) {
            const libPath = getDefaultLibFilePath(options);
            return libPath;
        },
        getScriptFileNames() {
            return fileNames;
        },
        getScriptSnapshot(filePath) {
            const uri = pathToFileURL(getFileName(filePath)).href;
            const doc = docManager.getEmbeddedDocument(
                uri,
                'javascript'
            );
            const fileText = doc ? doc.getText() : '';
            // console.log("scriptSnapShpt", filePath, fileText);
            // console.log("fileText", fileText);
            return ScriptSnapshot.fromString(fileText);
        },
        getScriptVersion(fileName) {
            if (fileName.includes('node_modules')) {
                return '0';
            }
            return '0';
        },
        fileExists(filePath) {
            const uri = pathToFileURL(getFileName(filePath)).href;
            const doc = docManager.getEmbeddedDocument(
                uri,
                'javascript'
            );
            return doc != null;
        },
        directoryExists: sys.directoryExists,
        readFile(filePath, encoding) {
            const uri = pathToFileURL(getFileName(filePath)).href;
            const doc = docManager.getEmbeddedDocument(
                uri,
                'javascript'
            );
            const fileText = doc ? doc.getText() : '';
            return fileText;
        }

    };
    const registry = createDocumentRegistry(
        false, workSpaceDir
    );
    const newService = createLanguageService(host, registry);
    return newService;
}

