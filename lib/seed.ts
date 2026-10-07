import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import type * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import * as path from 'node:path';
import { dbEnvironment } from './database';

export interface TodoSeedProps {
  readonly table: dynamodb.Table;
  readonly vpc?: ec2.Vpc;
  readonly vpcSubnets?: ec2.SubnetSelection;
}

export class TodoSeed extends Construct {
  constructor(scope: Construct, id: string, props: TodoSeedProps) {
    super(scope, id);

    const seedFn = new NodejsFunction(this, 'SeedFn', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, '../lambda/seed-handler.ts'),
      handler: 'handler',
      bundling: { externalModules: [] },
      environment: dbEnvironment(props.table.tableName),
      vpc: props.vpc,
      vpcSubnets: props.vpcSubnets,
    });
    props.table.grantReadWriteData(seedFn);

    const provider = new cdk.custom_resources.Provider(this, 'SeedProvider', {
      onEventHandler: seedFn,
    });

    new cdk.CustomResource(this, 'SeedCustomResource', {
      serviceToken: provider.serviceToken,
      resourceType: 'Custom::TodoSeed',
      properties: {
        schemaVersion: '1',
      },
    });
  }
}
