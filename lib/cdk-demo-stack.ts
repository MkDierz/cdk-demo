import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DemoDatabase } from './database';
import { TodoSeed } from './seed';
import { TodoApi } from './graphql-api';

export class CdkDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const database = new DemoDatabase(this, 'Database');

    // Creates the table + sample rows before anything queries it.
    new TodoSeed(this, 'Seed', {
      cluster: database.cluster,
      databaseName: database.databaseName,
      schemaVersion: '1',
    });

    const api = new TodoApi(this, 'Api', {
      cluster: database.cluster,
      databaseName: database.databaseName,
    });

    new cdk.CfnOutput(this, 'GraphQLUrl', { value: api.api.graphqlUrl });
    if (api.api.apiKey) {
      new cdk.CfnOutput(this, 'GraphQLApiKey', { value: api.api.apiKey });
    }
  }
}
