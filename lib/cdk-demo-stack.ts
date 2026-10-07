import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DemoDatabase, dbEnvironment } from './database';
import { TodoSeed } from './seed';
import { TodoApi } from './graphql-api';

export class CdkDemoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const database = new DemoDatabase(this, 'Database');

    new TodoSeed(this, 'Seed', {
      table: database.table,
    });

    const api = new TodoApi(this, 'Api', {
      table: database.table,
    });

    new cdk.CfnOutput(this, 'GraphQLUrl', { value: api.api.graphqlUrl });
    if (api.api.apiKey) {
      new cdk.CfnOutput(this, 'GraphQLApiKey', { value: api.api.apiKey });
    }
  }
}
