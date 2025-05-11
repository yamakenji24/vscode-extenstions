import * as vscode from "vscode";
import { extractIPAddresses, lookupIP, IPInfo } from "./ipUtils";

interface RequestData {
  timestamp: Date;
  count: number;
}

interface TimeInterval {
  start: Date;
  end: Date;
  count: number;
  isSpike: boolean;
}

interface IPAnalysis {
  ip: string;
  count: number;
  countryCode: string;
  countryName: string;
  region: string;
  city: string;
  org: string;
}

export class LogAnalyzer {
  private panel: vscode.WebviewPanel | undefined;
  private ipCache: Map<string, IPInfo> = new Map();

  constructor() {}

  public async analyzeRequests(editor: vscode.TextEditor) {
    const document = editor.document;
    const text = document.getText();
    const config = vscode.workspace.getConfiguration("logAnalyzer");

    // 時間間隔の設定を取得
    const timeInterval = config.get<string>("timeInterval") || "1h";
    const spikeThreshold = config.get<number>("spikeThreshold") || 2;
    const timestampFormat = config.get<string>("timestampFormat") || "ISO8601";

    // ログからリクエストデータを抽出
    const requestData = this.extractRequestData(text, timestampFormat);
    if (requestData.length === 0) {
      vscode.window.showInformationMessage(
        "No request data found in the log file"
      );
      return;
    }

    // 時間間隔ごとにデータを集計
    const intervals = this.aggregateByTimeInterval(requestData, timeInterval);

    // スパイクを検出
    const intervalsWithSpikes = this.detectSpikes(intervals, spikeThreshold);

    // Webviewパネルを作成
    this.createWebviewPanel(intervalsWithSpikes);
  }

  private extractRequestData(
    text: string,
    timestampFormat: string
  ): RequestData[] {
    // ログの形式に応じてタイムスタンプとリクエストを抽出
    const lines = text.split("\n");
    const requestData: RequestData[] = [];

    for (const line of lines) {
      // タイムスタンプの抽出（ISO8601形式を想定）
      const timestampMatch = line.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      if (timestampMatch) {
        const timestamp = new Date(timestampMatch[0]);
        requestData.push({ timestamp, count: 1 });
      }
    }

    return requestData;
  }

  private aggregateByTimeInterval(
    data: RequestData[],
    interval: string
  ): TimeInterval[] {
    const intervals: TimeInterval[] = [];
    const intervalMs = this.getIntervalMilliseconds(interval);

    // データを時間順にソート
    data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    let currentInterval: TimeInterval | null = null;

    for (const request of data) {
      const timestamp = request.timestamp.getTime();

      if (!currentInterval || timestamp >= currentInterval.end.getTime()) {
        if (currentInterval) {
          intervals.push(currentInterval);
        }
        currentInterval = {
          start: new Date(Math.floor(timestamp / intervalMs) * intervalMs),
          end: new Date(
            Math.floor(timestamp / intervalMs) * intervalMs + intervalMs
          ),
          count: 0,
          isSpike: false,
        };
      }
      currentInterval.count++;
    }

    if (currentInterval) {
      intervals.push(currentInterval);
    }

    return intervals;
  }

  private detectSpikes(
    intervals: TimeInterval[],
    threshold: number
  ): TimeInterval[] {
    // 平均と標準偏差を計算
    const counts = intervals.map((i) => i.count);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const stdDev = Math.sqrt(
      counts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / counts.length
    );

    // スパイクを検出
    return intervals.map((interval) => ({
      ...interval,
      isSpike: interval.count > mean + threshold * stdDev,
    }));
  }

  private getIntervalMilliseconds(interval: string): number {
    const value = parseInt(interval);
    const unit = interval.slice(-1);

    switch (unit) {
      case "m":
        return value * 60 * 1000;
      case "h":
        return value * 60 * 60 * 1000;
      case "d":
        return value * 24 * 60 * 60 * 1000;
      default:
        return 60 * 60 * 1000; // デフォルトは1時間
    }
  }

  private createWebviewPanel(intervals: TimeInterval[]) {
    this.panel = vscode.window.createWebviewPanel(
      "requestAnalysis",
      "Request Analysis",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    this.panel.webview.html = this.getWebviewContent(intervals);
  }

  private getWebviewContent(intervals: TimeInterval[]): string {
    return `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                    padding: 20px;
                    color: #cccccc;
                    background-color: #1e1e1e;
                }
                .chart-container {
                    position: relative;
                    height: 400px;
                    margin-bottom: 20px;
                }
                .summary {
                    background-color: #252526;
                    border: 1px solid #3c3c3c;
                    border-radius: 4px;
                    padding: 15px;
                    margin-bottom: 15px;
                }
                .spike {
                    color: #f14c4c;
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <h2>Request Analysis</h2>
            <div class="chart-container">
                <canvas id="requestChart"></canvas>
            </div>
            <div class="summary">
                <h3>Summary</h3>
                <p>Total Intervals: ${intervals.length}</p>
                <p>Spikes Detected: ${
                  intervals.filter((i) => i.isSpike).length
                }</p>
            </div>
            <script>
                const ctx = document.getElementById('requestChart').getContext('2d');
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: ${JSON.stringify(
                          intervals.map((i) => i.start.toLocaleTimeString())
                        )},
                        datasets: [{
                            label: 'Requests',
                            data: ${JSON.stringify(
                              intervals.map((i) => i.count)
                            )},
                            borderColor: 'rgb(75, 192, 192)',
                            tension: 0.1,
                            pointBackgroundColor: ${JSON.stringify(
                              intervals.map((i) =>
                                i.isSpike ? "#f14c4c" : "rgb(75, 192, 192)"
                              )
                            )}
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: {
                                    color: '#3c3c3c'
                                },
                                ticks: {
                                    color: '#cccccc'
                                }
                            },
                            x: {
                                grid: {
                                    color: '#3c3c3c'
                                },
                                ticks: {
                                    color: '#cccccc'
                                }
                            }
                        },
                        plugins: {
                            legend: {
                                labels: {
                                    color: '#cccccc'
                                }
                            }
                        }
                    }
                });
            </script>
        </body>
        </html>`;
  }

  public async analyzeIPs(editor: vscode.TextEditor) {
    const document = editor.document;
    const text = document.getText();

    // IPアドレスの抽出
    const ipAddresses = extractIPAddresses(text);
    if (ipAddresses.length === 0) {
      vscode.window.showInformationMessage(
        "No IP addresses found in the log file"
      );
      return;
    }

    // 進捗表示
    const progressOptions = {
      location: vscode.ProgressLocation.Notification,
      title: "Analyzing IP addresses...",
      cancellable: true,
    };

    try {
      await vscode.window.withProgress(
        progressOptions,
        async (progress, token) => {
          const ipCounts = new Map<string, number>();
          const ipAnalysis: IPAnalysis[] = [];

          // IPアドレスの出現回数をカウント
          for (const ip of ipAddresses) {
            ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
          }

          // キャッシュにないIPアドレスのみをルックアップ
          const uniqueIPs = Array.from(ipCounts.keys());
          const uncachedIPs = uniqueIPs.filter((ip) => !this.ipCache.has(ip));

          // 並列処理でルックアップを実行（最大5件ずつ）
          const batchSize = 5;
          for (let i = 0; i < uncachedIPs.length; i += batchSize) {
            if (token.isCancellationRequested) {
              break;
            }

            const batch = uncachedIPs.slice(i, i + batchSize);
            progress.report({
              message: `Looking up IPs (${i + 1}-${Math.min(
                i + batchSize,
                uncachedIPs.length
              )}/${uncachedIPs.length})`,
              increment: (100 * batchSize) / uncachedIPs.length,
            });

            try {
              const results = await Promise.allSettled(
                batch.map((ip) => lookupIP(ip))
              );

              results.forEach((result, index) => {
                if (result.status === "fulfilled") {
                  this.ipCache.set(batch[index], result.value);
                } else {
                  vscode.window.showWarningMessage(
                    `Failed to lookup ${batch[index]}: ${result.reason}`
                  );
                }
              });
            } catch (error) {
              vscode.window.showWarningMessage(
                `Error processing batch: ${error}`
              );
            }
          }

          // キャッシュから情報を取得して分析結果を作成
          for (const [ip, count] of ipCounts) {
            const ipInfo = this.ipCache.get(ip);
            if (ipInfo) {
              ipAnalysis.push({
                ...ipInfo,
                count,
              });
            }
          }

          // 結果をソート（アクセス数順）
          ipAnalysis.sort((a, b) => b.count - a.count);

          // Webviewパネルを作成
          this.createIPAnalysisPanel(ipAnalysis);
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Error: ${error}`);
    }
  }

  private createIPAnalysisPanel(ipAnalysis: IPAnalysis[]) {
    this.panel = vscode.window.createWebviewPanel(
      "ipAnalysis",
      "IP Address Analysis",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    this.panel.webview.html = this.getIPAnalysisContent(ipAnalysis);
  }

  private getIPAnalysisContent(ipAnalysis: IPAnalysis[]): string {
    // 国ごとの集計
    const countryStats = new Map<string, number>();
    for (const ip of ipAnalysis) {
      countryStats.set(
        ip.countryCode,
        (countryStats.get(ip.countryCode) || 0) + ip.count
      );
    }

    // 国ごとのデータを配列に変換
    const countryData = Array.from(countryStats.entries())
      .map(([code, count]) => ({
        code,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                padding: 20px;
                color: #cccccc;
                background-color: #1e1e1e;
            }
            .chart-container {
                position: relative;
                height: 400px;
                margin-bottom: 20px;
            }
            .summary {
                background-color: #252526;
                border: 1px solid #3c3c3c;
                border-radius: 4px;
                padding: 15px;
                margin-bottom: 15px;
            }
            .ip-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
            }
            .ip-table th, .ip-table td {
                padding: 8px;
                text-align: left;
                border-bottom: 1px solid #3c3c3c;
            }
            .ip-table th {
                background-color: #252526;
                color: #9cdcfe;
            }
            .ip-table tr:hover {
                background-color: #2a2d2e;
            }
        </style>
    </head>
    <body>
        <h2>IP Address Analysis</h2>
        
        <div class="summary">
            <h3>Summary</h3>
            <p>Total Unique IPs: ${ipAnalysis.length}</p>
            <p>Total Requests: ${ipAnalysis.reduce(
              (sum, ip) => sum + ip.count,
              0
            )}</p>
            <p>Unique Countries: ${countryStats.size}</p>
        </div>

        <div class="chart-container">
            <canvas id="countryChart"></canvas>
        </div>

        <h3>Top IP Addresses</h3>
        <table class="ip-table">
            <thead>
                <tr>
                    <th>IP Address</th>
                    <th>Count</th>
                    <th>Country</th>
                    <th>Region</th>
                    <th>City</th>
                    <th>Organization</th>
                </tr>
            </thead>
            <tbody>
                ${ipAnalysis
                  .slice(0, 20)
                  .map(
                    (ip) => `
                    <tr>
                        <td>${ip.ip}</td>
                        <td>${ip.count}</td>
                        <td>${ip.countryName} (${ip.countryCode})</td>
                        <td>${ip.region}</td>
                        <td>${ip.city}</td>
                        <td>${ip.org}</td>
                    </tr>
                `
                  )
                  .join("")}
            </tbody>
        </table>

        <script>
            const ctx = document.getElementById('countryChart').getContext('2d');
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ${JSON.stringify(countryData.map((d) => d.code))},
                    datasets: [{
                        label: 'Requests by Country',
                        data: ${JSON.stringify(
                          countryData.map((d) => d.count)
                        )},
                        backgroundColor: 'rgb(75, 192, 192)',
                        borderColor: 'rgb(75, 192, 192)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: '#3c3c3c'
                            },
                            ticks: {
                                color: '#cccccc'
                            }
                        },
                        x: {
                            grid: {
                                color: '#3c3c3c'
                            },
                            ticks: {
                                color: '#cccccc'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            labels: {
                                color: '#cccccc'
                            }
                        }
                    }
                }
            });
        </script>
    </body>
    </html>`;
  }
}
