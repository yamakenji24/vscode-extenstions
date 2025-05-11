import * as vscode from "vscode";
import { IPLookupManager } from "./IPLookupManager";
import { LogAnalyzer } from "./LogAnalyzer";

export function activate(context: vscode.ExtensionContext) {
  console.log("Extension is now active!");

  const ipLookupManager = new IPLookupManager();
  const logAnalyzer = new LogAnalyzer();

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

  let analyzeRequestsCommand = vscode.commands.registerCommand(
    "log-analyzer.analyzeRequests",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        logAnalyzer.analyzeRequests(editor);
      } else {
        vscode.window.showInformationMessage("Please open a log file first");
      }
    }
  );

  let analyzeIPsCommand = vscode.commands.registerCommand(
    "log-analyzer.analyzeIPs",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        logAnalyzer.analyzeIPs(editor);
      } else {
        vscode.window.showInformationMessage("Please open a log file first");
      }
    }
  );

  context.subscriptions.push(
    lookupIPCommand,
    analyzeRequestsCommand,
    analyzeIPsCommand
  );
}

export function deactivate() {}
