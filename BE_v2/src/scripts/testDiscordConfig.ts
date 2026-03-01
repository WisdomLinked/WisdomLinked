import { connectToDatabase } from "../config/database";
import { getSystemSettings } from "../models/SystemSettings";

async function testDiscordConfig() {
  console.log("Connecting to database...");
  await connectToDatabase();

  console.log("\n=== Discord OAuth Configuration ===\n");

  const settings = await getSystemSettings();

  console.log("Discord Login Enabled:", settings.loginMethods.discord);
  console.log("Registration Enabled:", settings.registrationEnabled);
  console.log("\nDiscord OAuth Settings:");
  console.log("  Client ID:", settings.discordOAuth?.clientId || "(not set)");
  console.log(
    "  Client Secret:",
    settings.discordOAuth?.clientSecret
      ? settings.discordOAuth.clientSecret.substring(0, 10) + "..."
      : "(not set)"
  );
  console.log("  Redirect URI:", settings.discordOAuth?.redirectUri || "(not set)");

  console.log("\n=== Checklist ===\n");

  const checks = [
    {
      name: "Discord login enabled",
      pass: settings.loginMethods.discord,
    },
    {
      name: "Client ID configured",
      pass: !!settings.discordOAuth?.clientId,
    },
    {
      name: "Client Secret configured",
      pass: !!settings.discordOAuth?.clientSecret,
    },
    {
      name: "Redirect URI configured",
      pass: !!settings.discordOAuth?.redirectUri,
    },
    {
      name: "Registration enabled",
      pass: settings.registrationEnabled,
    },
  ];

  for (const check of checks) {
    console.log(`${check.pass ? "✅" : "❌"} ${check.name}`);
  }

  console.log("\n=== Discord Developer Portal Checklist ===\n");
  console.log("Make sure you have done the following in Discord Developer Portal:");
  console.log(`1. Go to: https://discord.com/developers/applications/${settings.discordOAuth?.clientId}/oauth2`);
  console.log("2. Under 'OAuth2' → 'Redirects', add:");
  console.log(`   ${settings.discordOAuth?.redirectUri}`);
  console.log("3. Click 'Save Changes'");
  console.log("\n4. Under 'OAuth2' → 'Scopes', make sure you have:");
  console.log("   - identify");
  console.log("   - email");

  process.exit(0);
}

testDiscordConfig().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
