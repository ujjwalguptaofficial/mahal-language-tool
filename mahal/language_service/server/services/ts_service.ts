import { readFileSync, } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { createLanguageService, LanguageServiceHost, DocumentRegistry, findConfigFile, sys, CompilerOptions, getDefaultLibFilePath, ScriptSnapshot, createLanguageServiceSourceFile, createDocumentRegistry } from "typescript";
import { InitializeParams } from "vscode-languageserver-protocol";
import { ILanguageCache, IMahalDocumentRegion } from "../interfaces";
import { getContentFromXmlNode, getRangeFromXmlNode } from "../helpers";


export function getTypescriptService(params: InitializeParams) {

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
        getScriptSnapshot(fileName) {
            let fileText = sys.readFile(getFileName(fileName)) || '';
            // console.log("scriptSnapShpt", fileName, fileText);
            fileText = getContentFromXmlNode(fileText, 'script');
            // console.log("fileText", fileText);
            return ScriptSnapshot.fromString(fileText);
        },
        getScriptVersion(fileName) {
            if (fileName.includes('node_modules')) {
                return '0';
            }
            return '0';
        },
        fileExists(fileName) {
            return sys.fileExists(
                getFileName(fileName)
            );
        },
        directoryExists: sys.directoryExists,
        readFile(path, encoding) {
            return sys.readFile(getFileName(path), encoding);
        }

    };
    const registry = createDocumentRegistry(
        false, workSpaceDir
    );
    const newService = createLanguageService(host, registry);
    return newService;
}

