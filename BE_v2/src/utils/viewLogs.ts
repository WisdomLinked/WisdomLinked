import { connectToDatabase, disconnectFromDatabase } from "../config/database";
import { LogModel, LogLevel } from "../models/Log";

interface LogViewOptions {
  level?: LogLevel;
  limit?: number;
  showMetadata?: boolean;
}

async function viewLogs(options: LogViewOptions = {}) {
  const { level, limit = 50, showMetadata = true } = options;

  try {
    console.log("📊 Connecting to database...\n");
    await connectToDatabase();

    // Build query
    const query: { level?: LogLevel } = {};
    if (level) {
      query.level = level;
    }

    // Fetch logs
    const logs = await LogModel.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    if (logs.length === 0) {
      console.log("📭 No logs found");
      if (level) {
        console.log(`   (filtered by level: ${level})`);
      }
      return;
    }

    // Display logs
    console.log(`📝 Found ${logs.length} log(s)${level ? ` (level: ${level})` : ""}\n`);
    console.log("─".repeat(80));

    logs.forEach((log, index) => {
      // Color code based on level
      const levelEmoji = {
        error: "❌",
        warn: "⚠️ ",
        info: "ℹ️ ",
        debug: "🐛",
      }[log.level] || "📄";

      const timestamp = new Date(log.timestamp).toLocaleString();

      console.log(`\n${levelEmoji} [${log.level.toUpperCase()}] ${timestamp}`);
      console.log(`   ${log.message}`);

      if (showMetadata && log.metadata && Object.keys(log.metadata).length > 0) {
        console.log(`   Metadata:`);
        console.log(`   ${JSON.stringify(log.metadata, null, 2).split("\n").join("\n   ")}`);
      }

      if (index < logs.length - 1) {
        console.log("─".repeat(80));
      }
    });

    console.log("\n" + "─".repeat(80));
    console.log(`\n✅ Displayed ${logs.length} log entries\n`);
  } catch (error) {
    console.error("❌ Error viewing logs:", error);
    process.exit(1);
  } finally {
    await disconnectFromDatabase();
  }
}

// CLI interface
const args = process.argv.slice(2);
const options: LogViewOptions = {
  limit: 50,
  showMetadata: true,
};

// Parse command line arguments
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case "--level":
    case "-l":
      options.level = args[++i] as LogLevel;
      break;
    case "--limit":
    case "-n":
      options.limit = parseInt(args[++i]);
      break;
    case "--no-metadata":
      options.showMetadata = false;
      break;
    case "--help":
    case "-h":
      console.log(`
📊 Database Log Viewer

Usage: bun run src/utils/viewLogs.ts [options]

Options:
  -l, --level <level>     Filter by log level (error, warn, info, debug)
  -n, --limit <number>    Number of logs to display (default: 50)
  --no-metadata           Hide log metadata
  -h, --help              Show this help message

Examples:
  bun run src/utils/viewLogs.ts                    # View latest 50 logs
  bun run src/utils/viewLogs.ts -l error           # View only errors
  bun run src/utils/viewLogs.ts -n 100             # View latest 100 logs
  bun run src/utils/viewLogs.ts -l error -n 20    # View latest 20 errors
  bun run src/utils/viewLogs.ts --no-metadata     # Hide metadata
      `);
      process.exit(0);
  }
}

// Run the script
viewLogs(options);

