import * as vscode from "vscode";
import { extractIPAddresses, lookupIP, IPInfo } from "./ipUtils";

export class IPLookupManager {
  private panel: vscode.WebviewPanel | undefined;

  constructor() {}

  public async execute(editor: vscode.TextEditor) {
    const document = editor.document;
    const text = document.getText();
    const ipAddresses = extractIPAddresses(text);

    if (ipAddresses.length === 0) {
      vscode.window.showInformationMessage(
        "No IP addresses found in the current document"
      );
      return;
    }

    // Webviewパネルの作成
    this.panel = vscode.window.createWebviewPanel(
      "ipLookupResults",
      "IP Lookup Results",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    // 進捗表示
    const progressOptions = {
      location: vscode.ProgressLocation.Notification,
      title: "Looking up IP addresses...",
      cancellable: true,
    };

    try {
      await vscode.window.withProgress(
        progressOptions,
        async (progress, token) => {
          const results: IPInfo[] = [];

          for (let i = 0; i < ipAddresses.length; i++) {
            if (token.isCancellationRequested) {
              break;
            }

            const ip = ipAddresses[i];
            progress.report({
              message: `Looking up ${ip} (${i + 1}/${ipAddresses.length})`,
              increment: 100 / ipAddresses.length,
            });

            try {
              const result = await lookupIP(ip);
              results.push(result);
              // 結果をリアルタイムで更新
              this.updateWebview(results);
            } catch (error) {
              vscode.window.showWarningMessage(
                `Failed to lookup ${ip}: ${error}`
              );
            }
          }

          if (results.length === 0) {
            vscode.window.showErrorMessage(
              "No IP addresses could be looked up successfully"
            );
          }
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Error: ${error}`);
    }
  }

  private updateWebview(results: IPInfo[]) {
    if (this.panel) {
      this.panel.webview.html = this.getWebviewContent(results);
    }
  }

  private getWebviewContent(results: IPInfo[]): string {
    return `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                    padding: 20px;
                    line-height: 1.6;
                    color: #cccccc;
                    background-color: #1e1e1e;
                }
                .ip-info {
                    background-color: #252526;
                    border: 1px solid #3c3c3c;
                    border-radius: 4px;
                    padding: 15px;
                    margin-bottom: 15px;
                }
                .ip-info h3 {
                    margin-top: 0;
                    color: #569cd6;
                }
                .info-row {
                    display: flex;
                    margin-bottom: 5px;
                }
                .info-label {
                    font-weight: bold;
                    width: 150px;
                    color: #9cdcfe;
                }
                .copy-button {
                    background-color: #0e639c;
                    color: white;
                    border: none;
                    padding: 5px 10px;
                    border-radius: 3px;
                    cursor: pointer;
                    margin-left: 10px;
                }
                .copy-button:hover {
                    background-color: #1177bb;
                }
                h2 {
                    color: #569cd6;
                    border-bottom: 1px solid #3c3c3c;
                    padding-bottom: 10px;
                }
            </style>
        </head>
        <body>
            <h2>IP Lookup Results</h2>
            ${results
              .map(
                (result) => `
                <div class="ip-info">
                    <h3>IP: ${result.ip}</h3>
                    <div class="info-row">
                        <span class="info-label">Country:</span>
                        <span>${result.countryName} (${result.countryCode})</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Region:</span>
                        <span>${result.region}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">City:</span>
                        <span>${result.city}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">ISP/Organization:</span>
                        <span>${result.org}</span>
                    </div>
                </div>
            `
              )
              .join("")}
        </body>
        </html>`;
  }
}
