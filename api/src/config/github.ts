import "dotenv/config"

// export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
// export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";
// export const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || "http://localhost:3000/auth/github/callback";

export const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
export const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
export const USER_API_URL = "https://api.github.com/user";

export const REPO_SEARCH_URL ="https://api.github.com/search/repositories?q={query}{&page=10}";