import { connectToDatabase } from "../config/database";
import { updateSystemSettings } from "../models/SystemSettings";

async function configureDiscord() {
  console.log("Connecting to database...");
  await connectToDatabase();

  console.log("Configuring Discord OAuth...");

  await updateSystemSettings({
    loginMethods: {
      local: true,
      discord: true, // Enable Discord login
    },
    discordOAuth: {
      clientId: "1469968695035166730",
      clientSecret: "CfAw8yyeXDNBMMCF8o-lqakR75qlPeub",
      redirectUri: "http://localhost:5173/auth/discord/callback",
    },
  });

  console.log("✅ Discord OAuth configured successfully!");
  console.log("\nNext steps:");
  console.log("1. Make sure you added the redirect URI in Discord Developer Portal:");
  console.log("   http://localhost:5173/auth/discord/callback");
  console.log("\n2. Start your servers:");
  console.log("   Backend: cd backend && bun run dev");
  console.log("   Frontend: cd frontend && bun run dev");
  console.log("\n3. Test Discord login at http://localhost:5173/login");

  process.exit(0);
}

configureDiscord().catch((error) => {
  console.error("Failed to configure Discord:", error);
  process.exit(1);
});
