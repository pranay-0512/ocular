import randomize from "randomatic";
import axios from "axios";
import {
  AppauthorizationService,
  AppNameDefinitions,
  AppCategoryDefinitions,
  AuthToken,
  AuthStrategy,
  TokenTypes,
} from "@ocular/types";
import { ConfigModule } from "@ocular/ocular/src/types";

class AsanaOauth extends AppauthorizationService {
  protected client_id_: string;
  protected client_secret_: string;
  protected configModule_: ConfigModule;
  protected redirect_uri_: string;
  protected auth_strategy_: AuthStrategy;

  constructor(container, options) {
    super(arguments[0]);
    this.client_id_ = options.client_id;
    this.client_secret_ = options.client_secret;
    this.redirect_uri_ = options.redirect_uri;
    this.auth_strategy_ = options.auth_strategy;
    this.configModule_ = container.configModule;
  }

  static getAppDetails(projectConfig, options) {
    const client_id = options.client_id;
    const client_secret = options.client_secret;
    const redirect = options.redirect_uri;
    const auth_strategy = options.auth_strategy;
    return {
      name: AppNameDefinitions.ASANA,
      logo: "/asana.svg",
      description:
        "Asana is a web and mobile application designed to help teams organize, track, and manage their work. It's a popular project management tool that enables teams to collaborate more effectively.",
      oauth_url: `https://app.asana.com/-/oauth_authorize?response_type=code&client_id=${client_id}&redirect_uri=${redirect}`,
      slug: AppNameDefinitions.ASANA,
      category: AppCategoryDefinitions.PRODUCTIVITY,
      developer: "Ocular AI",
      images: ["/asana.svg"],
      auth_strategy: auth_strategy,
      overview: "Asana is a web and mobile application designed to help teams.",
      docs: "https://developers.asana.com",
      website: "https://asana.com",
    };
  }

  async refreshToken(refresh_token: string): Promise<AuthToken> {
    const body = {
      grant_type: "refresh_token",
      client_id: this.client_id_,
      client_secret: this.client_secret_,
      refresh_token: refresh_token,
    };

    const config = {
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
    };

    return axios
      .post(
        "https://app.asana.com/-/oauth_token",
        Object.keys(body)
          .map((key) => `${key}=${encodeURIComponent(body[key])}`)
          .join("&"),
        config
      )
      .then((res) => {
        return {
          token: res.data.access_token,
          token_expires_at: new Date(Date.now() + res.data.expires_in * 1000),
          refresh_token: res.data.refresh_token,
          refresh_token_expires_at: new Date(Date.now() + 172800 * 1000),
        } as AuthToken;
      })
      .catch((err) => {
        console.error(err);
        throw err;
      });
  }

  async generateToken(code: string): Promise<AuthToken> {
    console.log("***** Generating token from the code:\n");

    if (this.auth_strategy_ === AuthStrategy.API_TOKEN_STRATEGY) {
      return {
        type: TokenTypes.BEARER,
        token: code,
        token_expires_at: new Date(),
        refresh_token: code, // this should be refresh token for  API token
        refresh_token_expires_at: new Date(),
        auth_strategy: AuthStrategy.API_TOKEN_STRATEGY,
      } as AuthToken;
    }

    const body = {
      grant_type: "authorization_code",
      client_id: this.client_id_,
      client_secret: this.client_secret_,
      redirect_uri: this.redirect_uri_,
      code: code,
    };

    const config = {
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
    };

    return axios
      .post(
        "https://app.asana.com/-/oauth_token",
        Object.keys(body)
          .map((key) => `${key}=${encodeURIComponent(body[key])}`)
          .join("&"),
        config
      )
      .then((res) => {
        return {
          type: res.data.token_type,
          token: res.data.access_token,
          token_expires_at: new Date(Date.now() + res.data.expires_in * 1000),
          refresh_token: res.data.refresh_token,
          refresh_token_expires_at: new Date(Date.now() + 172800 * 1000),
          auth_strategy: AuthStrategy.OAUTH_TOKEN_STRATEGY,
        } as AuthToken;
      })
      .catch((err) => {
        console.error(err);
        throw err;
      });
  }
}

export default AsanaOauth;
