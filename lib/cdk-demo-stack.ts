import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ExternalDb, dbEnvironmentFromSecret } from './database';
import { TodoSeed } from './seed';
import { TodoApi } from './graphql-api';

export class CdkDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const database = new ExternalDb(this, 'Database');

    // Creates the table + sample rows before anything queries it.
    new TodoSeed(this, 'Seed', {
      host: database.host,
      port: database.port,
      databaseName: database.databaseName,
      secret: database.secret,
      schemaVersion: '1',
    });

    const api = new TodoApi(this, 'Api', {
      host: database.host,
      port: database.port,
      databaseName: database.databaseName,
      secret: database.secret,
    });

    new cdk.CfnOutput(this, 'GraphQLUrl', { value: api.api.graphqlUrl });
    if (api.api.apiKey) {
      new cdk.CfnOutput(this, 'GraphQLApiKey', { value: api.api.apiKey });
    }
  }
}
