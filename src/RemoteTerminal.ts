import * as vscode from 'vscode';
import { TelnetPseudoterminal } from 'vscode-telnet-pty';

export function installTerminal(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('remoteBrowserEnhance.terminal', () => {
            const terminal = vscode.window.createTerminal({
                name: `PseudoTerminal Demo`,
                pty: new TelnetPseudoterminal({ host: 'udev0-edu.faidev.cc', port: 50805, encoding: 'utf-8' }),
            });
            terminal.show();
        }),
    );
}
