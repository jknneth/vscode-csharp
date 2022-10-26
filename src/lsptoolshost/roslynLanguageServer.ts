/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
} from 'vscode-languageclient/node';

let client: LanguageClient;
let _channel: vscode.OutputChannel;

// Some hacky code to get VSCode to start up and connect to the new Roslyn LSP.
// TODO - will be removed and unified with the rest of the omnisharp code in BYO LSP.
// https://github.com/microsoft/vscode-csharp-next/issues/2
export async function activateRoslynLanguageServer(context: vscode.ExtensionContext) {

    _channel = vscode.window.createOutputChannel("Microsoft.CodeAnalysis.LanguageServer");
    console.log(`channel: ${JSON.stringify(_channel)}`);

    const workDirectory = process.cwd();
    const dotnetVersion = await exec('dotnet --version', workDirectory);
    console.log("Dotnet version: " + dotnetVersion);

    let serverOptions: ServerOptions = async () => {
        const process = startServer(_channel);
        return Promise.resolve<cp.ChildProcess>(process);
    };

    // Options to control the language client
    let clientOptions: LanguageClientOptions = {
        // Register the server for plain csharp documents
        documentSelector: ['csharp'],
        synchronize: {
            // Notify the server about file changes to '.clientrc files contain in the workspace
            fileEvents: vscode.workspace.createFileSystemWatcher('**/*.*')
        },
        traceOutputChannel: _channel,
        outputChannel: _channel,
    };

    // Create the language client and start the client.
    client = new LanguageClient(
        'microsoft-codeanalysis-languageserver',
        'Microsoft.CodeAnalysis.LanguageServer',
        serverOptions,
        clientOptions
    );

    client.registerProposedFeatures();

    // Start the client. This will also launch the server
    client.start();
}

// this method is called when your extension is deactivated
export async function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}

export async function exec(command: string, workDirectory: string = process.cwd(), env: NodeJS.ProcessEnv = process.env): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        cp.exec(command, { cwd: workDirectory, env }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            }
            else if (stderr) {
                reject(new Error(stderr));
            }
            else {
                resolve(stdout);
            }
        });
    });
}

function startServer(outputChannel: vscode.OutputChannel) : cp.ChildProcess {
    let clientRoot = __dirname;
    const serverPath = path.join(clientRoot, "..", "server", "Microsoft.CodeAnalysis.LanguageServer", "bin", "Debug", "net7.0", "Microsoft.CodeAnalysis.LanguageServer.dll");

    if (!fs.existsSync(serverPath)) {
        const error = new Error(`Cannot find language server in path '${serverPath}''`);
        throw error;
    }

    let args: string[] = [
        serverPath,
        "--debug",
    ];

    let childProcess = cp.spawn('dotnet', args);
    return childProcess;
}