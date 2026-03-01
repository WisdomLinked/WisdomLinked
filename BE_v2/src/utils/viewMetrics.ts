import { connectToDatabase, disconnectFromDatabase } from "../config/database";
import { MetricsModel } from "../models/Metrics";

interface MetricsViewOptions {
  limit?: number;
  path?: string;
  authenticated?: boolean;
}

async function viewMetrics(options: MetricsViewOptions = {}) {
  const { limit = 50, path, authenticated } = options;

  try {
    console.log("📊 Connecting to database...\n");
    await connectToDatabase();

    // Build query
    const query: { path?: string; isAuthenticated?: boolean } = {};
    if (path) {
      query.path = path;
    }
    if (authenticated !== undefined) {
      query.isAuthenticated = authenticated;
    }

    // Fetch metrics
    const metrics = await MetricsModel.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    if (metrics.length === 0) {
      console.log("📭 No metrics found");
      return;
    }

    // Calculate summary
    const total = await MetricsModel.countDocuments();
    const authenticatedCount = await MetricsModel.countDocuments({ isAuthenticated: true });
    const anonymousCount = await MetricsModel.countDocuments({ isAuthenticated: false });

    // Get top endpoints
    const topEndpoints = await MetricsModel.aggregate([
      {
        $group: {
          _id: "$path",
          count: { $sum: 1 },
          avgResponseTime: { $avg: "$responseTime" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Display summary
    console.log("📈 METRICS SUMMARY");
    console.log("═".repeat(80));
    console.log(`Total Requests:        ${total}`);
    console.log(`Authenticated:         ${authenticatedCount} (${((authenticatedCount / total) * 100).toFixed(1)}%)`);
    console.log(`Anonymous:             ${anonymousCount} (${((anonymousCount / total) * 100).toFixed(1)}%)`);
    console.log("\n🔝 TOP ENDPOINTS");
    console.log("─".repeat(80));

    topEndpoints.forEach((endpoint, index) => {
      console.log(
        `${index + 1}. ${endpoint._id.padEnd(40)} ${endpoint.count} hits (avg ${Math.round(endpoint.avgResponseTime || 0)}ms)`
      );
    });

    // Display recent metrics
    console.log("\n📝 RECENT REQUESTS");
    console.log("─".repeat(80));

    metrics.forEach((metric) => {
      const timestamp = new Date(metric.timestamp).toLocaleString();
      const auth = metric.isAuthenticated ? "🔐 Auth" : "🌐 Anon";
      const user = metric.username || "anonymous";
      const responseTime = metric.responseTime ? `${metric.responseTime}ms` : "N/A";
      const status = metric.statusCode || "N/A";

      console.log(`${timestamp} | ${auth} | ${metric.method.padEnd(6)} | ${status} | ${responseTime.padEnd(8)} | ${metric.path}`);
      console.log(`   User: ${user} | IP: ${metric.ip}`);
      console.log("─".repeat(80));
    });

    console.log(`\n✅ Displayed ${metrics.length} metric entries (of ${total} total)\n`);
  } catch (error) {
    console.error("❌ Error viewing metrics:", error);
    process.exit(1);
  } finally {
    await disconnectFromDatabase();
  }
}

// CLI interface
const args = process.argv.slice(2);
const options: MetricsViewOptions = {
  limit: 50,
};

// Parse command line arguments
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case "--path":
    case "-p":
      options.path = args[++i];
      break;
    case "--limit":
    case "-n":
      options.limit = parseInt(args[++i]);
      break;
    case "--authenticated":
    case "-a":
      options.authenticated = true;
      break;
    case "--anonymous":
      options.authenticated = false;
      break;
    case "--help":
    case "-h":
      console.log(`
📊 Database Metrics Viewer

Usage: bun run src/utils/viewMetrics.ts [options]

Options:
  -p, --path <path>       Filter by endpoint path
  -n, --limit <number>    Number of metrics to display (default: 50)
  -a, --authenticated     Show only authenticated requests
  --anonymous             Show only anonymous requests
  -h, --help              Show this help message

Examples:
  bun run src/utils/viewMetrics.ts                        # View latest 50 metrics
  bun run src/utils/viewMetrics.ts -n 100                 # View latest 100 metrics
  bun run src/utils/viewMetrics.ts -p /api/v1/users      # Filter by path
  bun run src/utils/viewMetrics.ts -a                     # Only authenticated requests
  bun run src/utils/viewMetrics.ts --anonymous           # Only anonymous requests
      `);
      process.exit(0);
  }
}

// Run the script
viewMetrics(options);

