import * as vscode from "vscode";
import { IPLookupManager } from "./IPLookupManager";

export function activate(context: vscode.ExtensionContext) {
  console.log("Extension is now active!");

  const ipLookupManager = new IPLookupManager();

  let lookupIPCommand = vscode.commands.registerCommand(
    "ip-lookup.lookupIPs",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        ipLookupManager.execute(editor);
      } else {
        vscode.window.showInformationMessage("Please open a file first");
      }
    }
  );

  context.subscriptions.push(lookupIPCommand);
}

export function deactivate() {}
