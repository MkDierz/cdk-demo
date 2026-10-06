import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import type * as rds from 'aws-cdk-lib/aws-rds';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import * as path from 'node:path';
import { dbEnvironment } from './database';

export interface TodoSeedProps {
  readonly cluster: rds.DatabaseCluster;
  readonly databaseName: string;
  /** Bump this to re-run the idempotent DDL/seed on the next deploy. */
  readonly schemaVersion: string;
}

/**
 * Runs CREATE TABLE + sample-row SQL on every deploy via a CloudFormation
 * custom resource (the seed Lambda is invoked by CloudFormation itself).
 */
export class TodoSeed extends Construct {
  constructor(scope: Construct, id: string, props: TodoSeedProps) {
    super(scope, id);

    const seedFn = new NodejsFunction(this, 'Handler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, '../lambda/seed-handler.ts'),
      handler: 'handler',
      timeout: cdk.Duration.minutes(2),
      // Bundle the AWS SDK too — the Lambda runtime copy may differ from ours.
      bundling: { externalModules: [] },
      environment: dbEnvironment(props.cluster, props.databaseName),
    });
    props.cluster.grantDataApiAccess(seedFn);

    const provider = new cr.Provider(this, 'Provider', { onEventHandler: seedFn });

    new cdk.CustomResource(this, 'Resource', {
      serviceToken: provider.serviceToken,
      resourceType: 'Custom::TodoSeed',
      properties: { schemaVersion: props.schemaVersion },
    });
  }
}
