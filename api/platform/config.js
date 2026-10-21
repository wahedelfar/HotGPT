module.exports = function handler(_req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  const config = {
    projectId: process.env.MANUS_PROJECT_ID || "",
    oauthPortalUrl: process.env.MANUS_OAUTH_PORTAL_URL || "",
    apiUrl: process.env.MANUS_API_URL || "",
    apiBrowserKey: process.env.MANUS_API_BROWSER_KEY || "",
  };
  res.statusCode = 200;
  res.end("window.__MANUS_CONFIG__=" + JSON.stringify(config).replace(/</g, "\\u003c") + ";");
};
