import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface ExternalDbConfig {
  readonly host: string;
  readonly port: number;
  readonly databaseName: string;
  readonly secret: secretsmanager.ISecret;
}

export class ExternalDb extends Construct {
  public readonly host: string;
  public readonly port: number;
  public readonly databaseName = 'todos';
  public readonly secret: secretsmanager.ISecret;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // For external managed DB, credentials should come from Secrets Manager.
    // Create a placeholder secret; in real deployments reference an existing one.
    this.secret = new secretsmanager.Secret(this, 'DbSecret', {
      secretName: 'cdk-demo/external-db',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'postgres',
          host: 'localhost',
          port: 5432,
          dbname: this.databaseName,
        }),
        generateStringKey: 'password',
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.host = 'localhost';
    this.port = 5432;
  }
}

export function dbEnvironmentFromSecret(
  host: string,
  port: number,
  databaseName: string,
  secret: secretsmanager.ISecret,
): Record<string, string> {
  return {
    DB_HOST: host,
    DB_PORT: port.toString(),
    DB_NAME: databaseName,
    DB_SECRET_ARN: secret.secretArn,
  };
}
