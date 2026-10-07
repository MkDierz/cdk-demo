import * as cdk from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import type * as rds from 'aws-cdk-lib/aws-rds';
import type * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import * as path from 'node:path';
import { dbEnvironment } from './database';

export interface TodoApiProps {
  readonly cluster: rds.DatabaseCluster;
  readonly databaseName: string;
  readonly vpc?: ec2.Vpc;
  readonly vpcSubnets?: ec2.SubnetSelection;
}

export class TodoApi extends Construct {
  public readonly api: appsync.GraphqlApi;

  constructor(scope: Construct, id: string, props: TodoApiProps) {
    super(scope, id);

    this.api = new appsync.GraphqlApi(this, 'Api', {
      name: 'cdk-demo-todos',
      definition: appsync.Definition.fromFile(path.join(__dirname, '../graphql/schema.graphql')),
      authorizationConfig: {
        defaultAuthorization: { authorizationType: appsync.AuthorizationType.API_KEY },
      },
    });

    const resolverFn = new NodejsFunction(this, 'ResolverFn', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, '../lambda/handler.ts'),
      handler: 'handler',
      timeout: cdk.Duration.seconds(30),
      // Bundle the AWS SDK too — the Lambda runtime copy may differ from ours.
      bundling: { externalModules: ['@aws-sdk/client-rds-data'] }, // not needed now, but keep flexible
      environment: dbEnvironment(props.cluster, props.databaseName),
      vpc: props.vpc,
      vpcSubnets: props.vpcSubnets,
    });
    props.cluster.grantDataApiAccess(resolverFn);

    const dataSource = this.api.addLambdaDataSource('TodoDataSource', resolverFn);

    // One Lambda serves every field: AppSync sends typeName/fieldName in the
    // event, and handler.ts dispatches to the right SQL with a switch.
    dataSource.createResolver('ListTodos', { typeName: 'Query', fieldName: 'listTodos' });
    dataSource.createResolver('GetTodo', { typeName: 'Query', fieldName: 'getTodo' });
    dataSource.createResolver('AddTodo', { typeName: 'Mutation', fieldName: 'addTodo' });
    dataSource.createResolver('ToggleTodo', { typeName: 'Mutation', fieldName: 'toggleTodo' });
  }
}
