import { readFileSync, } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { createLanguageService, LanguageServiceHost, findConfigFile, sys, CompilerOptions, getDefaultLibFilePath, ScriptSnapshot, createLanguageServiceSourceFile, createDocumentRegistry, LanguageServiceMode } from "typescript";
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
        tsConfig = {
            "compilerOptions": {
                "baseUrl": "",
                "declaration": false,
                "emitDecoratorMetadata": true,
                "experimentalDecorators": true,
                "lib": [
                    "es2015",
                    "dom",
                    "webworker",
                    "ES5",
                    "ES6"
                ],
                "mapRoot": "./",
                "module": "es6",
                "moduleResolution": "node",
                "outDir": "bin/ts",
                "sourceMap": true,
                "target": "es5"
            }
        }
        
        // readFileSync(tsConfigPath, {
        //     encoding: 'utf8'
        // });

    }
    else {
        tsConfig = {
            allowJs: true,
            declaration: false,

        } as CompilerOptions
    }

    console.log('path', tsConfigPath);
    console.log('tsconfig', tsConfig);


    const fileNames = sys.readDirectory(
        workSpaceDir, ['mahal', 'mhl']
    ).map(item => {
        return pathToFileURL(item + ".ts").href;
    })
    console.log("dir", fileNames);
    const getFileName = (fileName: string) => {
        return fileName.substr(0, fileName.length - 3)
    }
    let version = 0;
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
            console.log("libPath", libPath);
            console.log("options", options);
            return libPath;
        },
        getScriptFileNames() {
            // const files = Array.from(docManager.docs.keys as any).map(item => {
            //     return item + ".ts"
            // });
            // console.log("getScriptFileNames", files);
            return fileNames;
        },
        getScriptSnapshot(filePath) {
            const uri = getFileName(filePath);
            const doc = docManager.getEmbeddedDocument(
                uri,
                'javascript'
            );
            const fileText = doc ? doc.getText() : '';
            // console.log("scriptSnapShpt", uri, filePath, fileText, Array.from(docManager.docs.keys()));
            console.log("fileText", fileText.length, `'${fileText}'`);
            return ScriptSnapshot.fromString(fileText);
        },
        getScriptVersion(fileName) {
            if (fileName.includes('node_modules')) {
                return '0';
            }
            return (version++).toString();
        },
        fileExists(filePath) {
            console.log("file exist", filePath);
            const uri = pathToFileURL(getFileName(filePath)).href;
            const doc = docManager.getEmbeddedDocument(
                uri,
                'javascript'
            );
            console.log("file exist", doc != null);
            return doc != null;
        },
        directoryExists: sys.directoryExists,
        readFile(filePath, encoding) {

            const uri = getFileName(filePath);
            const doc = docManager.getEmbeddedDocument(
                uri,
                'javascript'
            );
            const fileText = doc ? doc.getText() : '';
            console.log("readFile", filePath, "fileText", fileText);

            return fileText;
        },
        useCaseSensitiveFileNames: () => true
    };
    const registry = createDocumentRegistry(
        true, workSpaceDir
    );

    const newService = createLanguageService(host, registry);

    return newService;
}

