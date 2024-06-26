import { IsNotEmpty, IsString, IsEnum, IsOptional } from "class-validator";
import { validator } from "@ocular/utils";
import {
  AppAuthorizationService,
  OrganisationService,
} from "../../../../services";
import { AppNameDefinitions } from "@ocular/types";

export default async (req, res) => {
  const validated = await validator(PostAppsReq, req.body);
  const appAuthorizationService: AppAuthorizationService = req.scope.resolve(
    "appAuthorizationService"
  );

  appAuthorizationService
    .generateToken(
      validated.name,
      validated.code,
      validated.installationId,
      validated.metadata
    )
    .then((token) => {
      res.status(200).json({ token: token });
    })
    .catch((error) => {
      // Handle error
      res.status(500).json({ error: `Error Installing App ${validated.name}` });

    });
};

export class PostAppsReq {
  @IsEnum(AppNameDefinitions)
  @IsNotEmpty()
  name: AppNameDefinitions;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  installationId?: string;

  @IsOptional()
  metadata?: any;
}
