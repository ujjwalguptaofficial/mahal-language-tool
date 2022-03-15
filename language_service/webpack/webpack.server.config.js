const path = require('path')

exports.default = {
    mode: "development",
    // devtool: 'source-map',
    entry: `./server/index.ts`,
    target: 'node',
    output: {
        path: path.join(__dirname, "./../dist"),
        filename: `server.js`,
        library: 'mahal_language_server',
        libraryTarget: 'commonjs2',
    },
    externals: {
        vscode: 'vscode',
        prettier: 'prettier',
        typescript: 'typescript',
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        modules: [path.resolve(__dirname, 'src'), 'node_modules'],
        extensions: ['.json', '.js', '.ts', 'tsx'],
        alias: {
            // "@": path.resolve(__dirname, "./src")
        },
    },
    plugins: [

    ],

}